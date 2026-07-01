# Notification/Toast/Confirmation UX Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace blocking `confirm.ask()` modals with non-blocking actionable toasts for low-stakes room decisions (stage invite, mod invite, raise-hand approval), and eliminate confirmed duplicate toast/notification delivery for events HelloTalk's backend pushes on both the BFF room socket and the global IM socket.

**Architecture:** Extend the existing `ToastService`/`Toast` model with an optional `actions` array (no new service, no new component) so callers attach Accept/Decline closures directly to a toast. Expose a new `activeCname` signal on `BffRoomSocketService` so `ImBootstrapService` can detect "is the BFF room socket already handling this room" and suppress its own duplicate toast/notification for the same event.

**Tech Stack:** Angular 22 signals, Vitest (via `@angular/build:unit-test`), RxJS (`firstValueFrom` for one-shot API calls), existing CDK-free toast container.

## Global Constraints

- Scope is `features/room/**`, `core/realtime/**`, `core/services/toast.service.ts`, `shared/ui/toast/**` only — do not touch other toast usage sites (header, managers-modal, comments-panel).
- No new files, no new service, no new component — extend `Toast`/`ToastService`/`ToastContainerComponent` in place per the approved design (see `docs/superpowers/specs/2026-07-01-notification-ux-design.md`).
- Every component stays `ChangeDetectionStrategy.OnPush`; no `standalone: true` (implicit default, per this codebase's CLAUDE.md).
- No hardcoded colors in new CSS — use design tokens (`--radius-md`, `--text-xs`, `--color-on-color`, `--color-neutral-*`, `--color-border`, `--toast-accent`), verified present in `src/styles/tokens.scss`.
- Dark mode: this file already uses a plain `.dark` ancestor selector (not `:host-context(.dark)`) for its dark overrides — follow that same local convention for any new dark-mode CSS in `toast-container.component.ts`.
- `npx tsc --noEmit` must stay clean after every task.
- Run a single spec file with: `npx ng test --include='<glob>' --watch=false`.

---

### Task 1: Actionable toasts in `ToastService`

**Files:**
- Modify: `src/app/core/services/toast.service.ts`
- Test: `src/app/core/services/toast.service.spec.ts` (new)

**Interfaces:**
- Produces: `export interface ToastAction { readonly label: string; readonly run: () => void; readonly variant?: 'primary' | 'ghost'; }`
- Produces: `Toast.actions?: readonly ToastAction[]` (new optional field on the existing `Toast` interface)
- Produces: `ToastService.action(message: string, actions: readonly ToastAction[], opts?: { type?: Toast['type']; duration?: number }): void`
- Consumes: nothing new — `Toast`, `TOAST_EXIT_MS`, `ToastService.show/dismiss` already exist in this file today.

- [ ] **Step 1: Write the failing test**

Create `src/app/core/services/toast.service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastService, TOAST_EXIT_MS } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
  });

  it('action() creates a toast carrying the given actions', () => {
    const run = vi.fn();
    service.action('Approve?', [{ label: 'Approve', run }]);

    const toasts = service.toasts();
    expect(toasts).toHaveLength(1);
    expect(toasts[0]!.message).toBe('Approve?');
    expect(toasts[0]!.actions).toEqual([{ label: 'Approve', run }]);
  });

  it('action() defaults type to info and duration to 20000ms', () => {
    service.action('Approve?', [{ label: 'Approve', run: () => {} }]);

    const toast = service.toasts()[0]!;
    expect(toast.type).toBe('info');
    expect(toast.duration).toBe(20_000);
  });

  it('action() accepts an explicit type and duration override', () => {
    service.action('Muted', [{ label: 'Undo', run: () => {} }], { type: 'warning', duration: 5000 });

    const toast = service.toasts()[0]!;
    expect(toast.type).toBe('warning');
    expect(toast.duration).toBe(5000);
  });

  it('auto-dismisses an actionable toast after its duration elapses, without invoking any action', () => {
    const run = vi.fn();
    service.action('Approve?', [{ label: 'Approve', run }]);

    vi.advanceTimersByTime(20_000);
    vi.advanceTimersByTime(TOAST_EXIT_MS);

    expect(service.toasts()).toHaveLength(0);
    expect(run).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --include='src/app/core/services/toast.service.spec.ts' --watch=false`
Expected: FAIL — `service.action is not a function` (method doesn't exist yet).

- [ ] **Step 3: Implement `action()` in `toast.service.ts`**

Replace the full contents of `src/app/core/services/toast.service.ts` with:

```ts
import { Injectable, signal, computed } from '@angular/core';

export interface ToastAction {
  readonly label: string;
  readonly run: () => void;
  readonly variant?: 'primary' | 'ghost';
}

export interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
  duration?: number;
  leaving?: boolean;
  actions?: readonly ToastAction[];
}

/** Must match the `.toast-leaving` exit animation duration in toast-container.component.ts. */
export const TOAST_EXIT_MS = 200;

/** Default auto-dismiss window for an actionable toast — longer than a plain
 *  toast's 3000ms default so there's real time to read and decide. */
const ACTION_TOAST_DURATION_MS = 20_000;

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  private enqueue(toast: Toast): void {
    this._toasts.update(current => [toast, ...current]);

    if (toast.duration && toast.duration > 0) {
      setTimeout(() => this.dismiss(toast.id), toast.duration);
    }
  }

  show(message: string, type: Toast['type'] = 'info', duration = 3000): void {
    this.enqueue({ id: crypto.randomUUID(), message, type, duration });
  }

  /** A toast carrying one or more action buttons (e.g. Accept/Decline). Tapping
   *  an action runs it and dismisses immediately; the ✕ button or timeout expiry
   *  just dismisses without running anything. */
  action(
    message: string,
    actions: readonly ToastAction[],
    opts?: { type?: Toast['type']; duration?: number },
  ): void {
    this.enqueue({
      id: crypto.randomUUID(),
      message,
      type: opts?.type ?? 'info',
      duration: opts?.duration ?? ACTION_TOAST_DURATION_MS,
      actions,
    });
  }

  dismiss(id: string): void {
    this._toasts.update(current =>
      current.map(t => (t.id === id ? { ...t, leaving: true } : t)),
    );
    setTimeout(() => {
      this._toasts.update(current => current.filter(t => t.id !== id));
    }, TOAST_EXIT_MS);
  }

  success(message: string, duration?: number): void {
    this.show(message, 'success', duration);
  }

  error(message: string, duration?: number): void {
    this.show(message, 'error', duration);
  }

  warning(message: string, duration?: number): void {
    this.show(message, 'warning', duration);
  }

  info(message: string, duration?: number): void {
    this.show(message, 'info', duration);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ng test --include='src/app/core/services/toast.service.spec.ts' --watch=false`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/core/services/toast.service.ts src/app/core/services/toast.service.spec.ts
git commit -m "feat(toast): add actionable toast support to ToastService"
```

---

### Task 2: Render action buttons in `ToastContainerComponent`

**Files:**
- Modify: `src/app/shared/ui/toast/toast-container.component.ts`
- Test: `src/app/shared/ui/toast/toast-container.component.spec.ts` (new)

**Interfaces:**
- Consumes: `ToastService.action()`, `ToastService.toasts()`, `Toast.actions` from Task 1.
- Produces: `ToastContainerComponent.onAction(toast: Toast, action: ToastAction): void` (calls `action.run()` then `toastService.dismiss(toast.id)`).

- [ ] **Step 1: Write the failing test**

Create `src/app/shared/ui/toast/toast-container.component.spec.ts`:

```ts
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastContainerComponent } from './toast-container.component';
import { ToastService, TOAST_EXIT_MS } from '@core/services/toast.service';

describe('ToastContainerComponent', () => {
  let fixture: ComponentFixture<ToastContainerComponent>;
  let toastService: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ imports: [ToastContainerComponent] });
    fixture = TestBed.createComponent(ToastContainerComponent);
    toastService = TestBed.inject(ToastService);
    fixture.detectChanges();
  });

  it('renders no action row for a plain toast', () => {
    toastService.info('Just FYI');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.toast-actions')).toBeNull();
  });

  it('renders one button per action, in order', () => {
    toastService.action('Approve?', [
      { label: 'Approve', run: () => {} },
      { label: 'Dismiss', run: () => {} },
    ]);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('.toast-action');
    expect(buttons).toHaveLength(2);
    expect(buttons[0].textContent.trim()).toBe('Approve');
    expect(buttons[1].textContent.trim()).toBe('Dismiss');
  });

  it('clicking an action button runs it and dismisses the toast', () => {
    const run = vi.fn();
    toastService.action('Approve?', [{ label: 'Approve', run }]);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.toast-action') as HTMLButtonElement;
    button.click();
    fixture.detectChanges();

    expect(run).toHaveBeenCalledOnce();
    expect(toastService.toasts()[0]!.leaving).toBe(true);

    vi.advanceTimersByTime(TOAST_EXIT_MS);
    expect(toastService.toasts()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --include='src/app/shared/ui/toast/toast-container.component.spec.ts' --watch=false`
Expected: FAIL — `.toast-action` never found (template doesn't render actions yet).

- [ ] **Step 3: Update the template, styles, and add `onAction()`**

In `src/app/shared/ui/toast/toast-container.component.ts`:

1. Update the import line to bring in the new types:

```ts
import { ToastService, Toast, ToastAction } from '@core/services/toast.service';
```

2. Replace the `<span class="toast-message">{{ toast.message }}</span>` line in the template with:

```html
          <div class="toast-body">
            <span class="toast-message">{{ toast.message }}</span>
            @if (toast.actions?.length) {
              <div class="toast-actions">
                @for (action of toast.actions; track action.label) {
                  <button
                    type="button"
                    class="toast-action"
                    [class.toast-action-primary]="action.variant === 'primary'"
                    (click)="onAction(toast, action)"
                  >
                    {{ action.label }}
                  </button>
                }
              </div>
            }
          </div>
```

3. In the `styles` array, change `.toast-message { flex: 1; ... }` to remove `flex: 1;` from `.toast-message` and add a new `.toast-body` rule that owns the flex sizing, plus styles for the new buttons:

```scss
    .toast-body {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .toast-message {
      font-size: var(--text-sm);
      font-weight: 500;
      color: var(--color-text);
    }

    .toast-actions {
      display: flex;
      gap: 8px;
    }

    .toast-action {
      padding: 6px 12px;
      border-radius: var(--radius-md);
      border: 1px solid var(--color-border);
      background: transparent;
      color: var(--color-text);
      font-size: var(--text-xs);
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.15s ease;
    }

    .toast-action:hover {
      background-color: var(--color-neutral-100);
    }

    .dark .toast-action:hover {
      background-color: var(--color-neutral-700);
    }

    .toast-action-primary {
      border-color: transparent;
      background: var(--toast-accent);
      color: var(--color-on-color);
    }

    .toast-action-primary:hover {
      filter: brightness(0.92);
    }
```

   (`.toast-message` keeps its font styles but loses `flex: 1`, since `.toast-body` now owns that.)

4. Add the click handler to the component class:

```ts
export class ToastContainerComponent {
  readonly toastService = inject(ToastService);

  onAction(toast: Toast, action: ToastAction): void {
    action.run();
    this.toastService.dismiss(toast.id);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ng test --include='src/app/shared/ui/toast/toast-container.component.spec.ts' --watch=false`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/shared/ui/toast/toast-container.component.ts src/app/shared/ui/toast/toast-container.component.spec.ts
git commit -m "feat(toast): render action buttons for actionable toasts"
```

---

### Task 3: Expose `activeCname` on `BffRoomSocketService`

**Files:**
- Modify: `src/app/core/realtime/bff-room-socket.service.ts`
- Test: `src/app/core/realtime/bff-room-socket.service.spec.ts` (existing — add cases)

**Interfaces:**
- Produces: `BffRoomSocketService.activeCname: Signal<string>` — `''` when disconnected, the connected room's `cname` otherwise.

- [ ] **Step 1: Write the failing test**

Add to the existing `describe('BffRoomSocketService', ...)` block in `src/app/core/realtime/bff-room-socket.service.spec.ts` (after the last existing `it(...)`, before the closing `});`):

```ts
  it('activeCname reflects the connected room and clears on disconnect', async () => {
    expect(service.activeCname()).toBe('');

    service.connect('VR_1_2');
    expect(service.activeCname()).toBe('VR_1_2');

    await service.disconnect();
    expect(service.activeCname()).toBe('');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --include='src/app/core/realtime/bff-room-socket.service.spec.ts' --watch=false`
Expected: FAIL — `service.activeCname is not a function`.

- [ ] **Step 3: Add the signal**

In `src/app/core/realtime/bff-room-socket.service.ts`:

1. Add a new private signal alongside the existing ones:

```ts
  private readonly _lastEvent = signal<RoomRealtimeEvent | null>(null);
  private readonly _wsStatus = signal<WsConnectionStatus>('disconnected');
  private readonly _activeCname = signal<string>('');
  readonly lastEvent = this._lastEvent.asReadonly();
  readonly wsStatus = this._wsStatus.asReadonly();
  readonly activeCname = this._activeCname.asReadonly();
```

2. In `connect()`, set it right after `this.reconnectCname = cname;`:

```ts
  connect(cname: string, hostId = 0, busiType = 2, heartbeatSeconds: number | null = null): void {
    if (this.reconnectCname === cname && (this.sock || this.connecting)) return;
    this.teardownSocket();
    this.reconnectCname = cname;
    this._activeCname.set(cname);
    this.reconnectHostId = hostId;
    this.reconnectBusiType = busiType;
    this.reconnectHeartbeatSeconds = heartbeatSeconds;
    this.reconnectAttempt = 0;
    this.connecting = true;
    this.open();
  }
```

3. In `disconnect()`, clear it right after `this.reconnectCname = '';`:

```ts
  async disconnect(): Promise<void> {
    this.reconnectCname = '';
    this._activeCname.set('');
    this.reconnectHostId = 0;
    this.reconnectBusiType = 2;
    this.reconnectHeartbeatSeconds = null;
    this.reconnectAttempt = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.connecting = false;
    this._wsStatus.set('disconnected');
    this.teardownSocket();
    this.sock = null;
    this._lastEvent.set(null);
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ng test --include='src/app/core/realtime/bff-room-socket.service.spec.ts' --watch=false`
Expected: PASS (all existing tests + the new one)

- [ ] **Step 5: Commit**

```bash
git add src/app/core/realtime/bff-room-socket.service.ts src/app/core/realtime/bff-room-socket.service.spec.ts
git commit -m "feat(realtime): expose activeCname on BffRoomSocketService"
```

---

### Task 4: Dedup and downgrade `ImBootstrapService`

**Files:**
- Modify: `src/app/core/realtime/im-bootstrap.service.ts`
- Test: `src/app/core/realtime/im-bootstrap.service.spec.ts` (new)

**Interfaces:**
- Consumes: `BffRoomSocketService.activeCname` (Task 3), `ImSocketService.lastEvent`/`connect()` (existing), `NOTIFICATION_REPORTER.notify(type, title, message?)` (existing), `ToastService.error/warning` (existing).
- Produces: no new public API — `ImBootstrapService` stays a root-provided side-effect-only service.

- [ ] **Step 1: Write the failing tests**

Create `src/app/core/realtime/im-bootstrap.service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStore } from '@core/auth/auth.store';
import { ToastService } from '@core/services/toast.service';
import { NOTIFICATION_REPORTER } from '@core/tokens/notification-reporter.token';
import { ImBootstrapService } from './im-bootstrap.service';
import { ImSocketService } from './im-socket.service';
import { BffRoomSocketService } from './bff-room-socket.service';
import type { ImEvent } from './im-events';

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  readonly url: string;
  readyState = 0;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  close(): void {
    this.readyState = 3;
  }
}

describe('ImBootstrapService', () => {
  let imSocket: ImSocketService;
  let bffWs: BffRoomSocketService;
  let toast: ToastService;
  let notify: ReturnType<typeof vi.fn>;
  let imSock: FakeWebSocket;

  function push(event: ImEvent): void {
    imSock.onmessage?.({ data: JSON.stringify(event) });
    TestBed.flushEffects();
  }

  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.stubGlobal('WebSocket', Object.assign(FakeWebSocket, { OPEN: 1, CLOSED: 3 }));
    notify = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthStore, useValue: { isAuthenticated: () => true } },
        { provide: NOTIFICATION_REPORTER, useValue: { notify } },
      ],
    });

    TestBed.inject(ImBootstrapService);
    TestBed.flushEffects(); // auth effect runs once: isAuthenticated() true -> imSocket.connect()

    imSocket = TestBed.inject(ImSocketService);
    bffWs = TestBed.inject(BffRoomSocketService);
    toast = TestBed.inject(ToastService);
    imSock = FakeWebSocket.instances[0]!;
  });

  it('suppresses stage_invite entirely when already in that room', () => {
    bffWs.connect('VR_1_2');
    push({ type: 'stage_invite', userId: '9', cname: 'VR_1_2' });

    expect(notify).not.toHaveBeenCalled();
    expect(toast.toasts()).toHaveLength(0);
  });

  it('notifies (no toast) for a stage_invite to a different room than the one currently joined', () => {
    bffWs.connect('VR_OTHER');
    push({ type: 'stage_invite', userId: '9', cname: 'VR_1_2' });

    expect(notify).toHaveBeenCalledWith('info', 'Stage invitation', 'The host invited you to join the stage');
    expect(toast.toasts()).toHaveLength(0);
  });

  it('notifies (no toast) for a stage_invite when not in any room', () => {
    push({ type: 'stage_invite', userId: '9', cname: 'VR_1_2' });

    expect(notify).toHaveBeenCalledWith('info', 'Stage invitation', 'The host invited you to join the stage');
    expect(toast.toasts()).toHaveLength(0);
  });

  it('suppresses mod_accepted entirely while in any room', () => {
    bffWs.connect('VR_1_2');
    push({ type: 'mod_accepted', userId: '9' });

    expect(notify).not.toHaveBeenCalled();
    expect(toast.toasts()).toHaveLength(0);
  });

  it('notifies mod_accepted (no toast) when not in a room', () => {
    push({ type: 'mod_accepted', userId: '9' });

    expect(notify).toHaveBeenCalledWith('info', 'Moderator', 'You are now a moderator');
    expect(toast.toasts()).toHaveLength(0);
  });

  it('notifies passive social events (follow) without toasting', () => {
    push({ type: 'follow', nickname: 'Sam', status: 1 });

    expect(notify).toHaveBeenCalledWith('info', 'New follower', 'Sam followed you');
    expect(toast.toasts()).toHaveLength(0);
  });

  it('still toasts an account ban', () => {
    push({ type: 'account_status', status: 'banned' });

    expect(toast.toasts()).toHaveLength(1);
    expect(toast.toasts()[0]!.type).toBe('error');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --include='src/app/core/realtime/im-bootstrap.service.spec.ts' --watch=false`
Expected: FAIL — several assertions fail because today's `handle()` always toasts+notifies for `stage_invite`/`mod_invite`/`mod_accepted`/`mod_removed`/`mod_unmuted` and toasts for the passive social events, with no room-awareness.

- [ ] **Step 3: Rewrite `im-bootstrap.service.ts`**

Replace the full contents of `src/app/core/realtime/im-bootstrap.service.ts` with:

```ts
import { Injectable, effect, inject } from '@angular/core';
import { AuthStore } from '@core/auth/auth.store';
import { ToastService } from '@core/services/toast.service';
import { NOTIFICATION_REPORTER } from '@core/tokens/notification-reporter.token';
import { BffRoomSocketService } from './bff-room-socket.service';
import { ImSocketService } from './im-socket.service';
import type { ImEvent } from './im-events';

@Injectable({ providedIn: 'root' })
export class ImBootstrapService {
  private readonly auth = inject(AuthStore);
  private readonly imSocket = inject(ImSocketService);
  private readonly bffWs = inject(BffRoomSocketService);
  private readonly toast = inject(ToastService);
  private readonly notifications = inject(NOTIFICATION_REPORTER);

  constructor() {
    effect(() => {
      if (this.auth.isAuthenticated()) {
        this.imSocket.connect();
      } else {
        this.imSocket.disconnect();
      }
    });

    effect(() => {
      const event = this.imSocket.lastEvent();
      if (event) this.handle(event);
    });
  }

  /** HelloTalk pushes stage_invite/mod_invite/mod_accepted/mod_removed/mod_unmuted
   *  on BOTH the LiveHub socket (BffRoomSocketService, room-scoped) and this global
   *  IM socket whenever the user is in the target room. When BffRoomSocketService is
   *  already handling the same room, this method must stay silent. */
  private handle(event: ImEvent): void {
    switch (event.type) {
      case 'profile_visit':
        this.notifications.notify('info', 'Profile visit', `${event.visitorUserId} visited your profile`);
        break;
      case 'stage_invite':
        if (event.cname === this.bffWs.activeCname()) break;
        this.notifications.notify('info', 'Stage invitation', 'The host invited you to join the stage');
        break;
      case 'mod_invite':
        if (event.cname === this.bffWs.activeCname()) break;
        this.notifications.notify('info', 'Moderator invitation', 'You have been invited to become a moderator');
        break;
      case 'mod_accepted':
        if (this.bffWs.activeCname()) break;
        this.notifications.notify('info', 'Moderator', 'You are now a moderator');
        break;
      case 'mod_removed':
        if (this.bffWs.activeCname()) break;
        this.notifications.notify('info', 'Moderator', 'You are no longer a moderator');
        break;
      case 'mod_unmuted':
        if (this.bffWs.activeCname()) break;
        this.notifications.notify('info', 'Stage', 'You can speak now');
        break;
      case 'follow':
        this.notifications.notify('info', 'New follower', event.status === 2 ? `${event.nickname} followed you back` : `${event.nickname} followed you`);
        break;
      case 'voice_room_shared':
        this.notifications.notify('info', 'Voice room shared', `${event.fromNickname} sent you a voice room`);
        break;
      case 'live_room_shared':
        this.notifications.notify('info', 'Live room shared', `${event.fromNickname} sent you a live room`);
        break;
      case 'text_message':
        this.notifications.notify('info', 'New message', event.text);
        break;
      case 'image_message':
        this.notifications.notify('info', 'New message', 'Sent you a photo');
        break;
      case 'gift_message':
        this.notifications.notify('info', 'Gift received', `${event.fromNickname} sent you a gift`);
        break;
      case 'introduction_message':
        this.notifications.notify('info', 'Introduction', `${event.fromNickname} sent you an introduction`);
        break;
      case 'group_message':
        this.notifications.notify('info', `${event.roomName}`, `${event.senderName}: ${event.text}`);
        break;
      case 'typing_indicator':
      case 'read_receipt':
        break;
      case 'account_status':
        if (event.status === 'banned') {
          this.toast.error('Your HelloTalk account has been banned.');
        } else {
          this.toast.warning('Logged in elsewhere — this session was disconnected.');
        }
        break;
      case 'error':
        break;
      case 'connection-state':
        break;
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ng test --include='src/app/core/realtime/im-bootstrap.service.spec.ts' --watch=false`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/core/realtime/im-bootstrap.service.ts src/app/core/realtime/im-bootstrap.service.spec.ts
git commit -m "fix(realtime): dedupe IM-socket events already handled by the BFF room socket"
```

---

### Task 5: Replace `confirm.ask()` with actionable toasts in `handle-realtime-event.util.ts`

**Files:**
- Modify: `src/app/features/room/data/handle-realtime-event.util.ts`
- Test: `src/app/features/room/data/handle-realtime-event.util.spec.ts` (new)

**Interfaces:**
- Produces: `handleRealtimeEvent(event, api, toast, cname, busiType, userId, isHost, getNickname): Promise<void>` — **signature changes**: the `confirm: ConfirmService` parameter is removed and `api`/`toast` move up to take its place. Task 6 updates the one call site to match.
- Consumes: `ToastService.action()` (Task 1), `RoomApi.stageInviteApproval/approveManager/raiseHandApproval` (existing, unchanged).

- [ ] **Step 1: Write the failing tests**

Create `src/app/features/room/data/handle-realtime-event.util.spec.ts`:

```ts
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ToastService } from '@core/services/toast.service';
import type { RoomApi } from '@features/room/data/room-api';
import { handleRealtimeEvent } from './handle-realtime-event.util';

function fakeApi(): RoomApi {
  return {
    stageInviteApproval: vi.fn(() => of(undefined)),
    approveManager: vi.fn(() => of(undefined)),
    raiseHandApproval: vi.fn(() => of(undefined)),
  } as unknown as RoomApi;
}

describe('handleRealtimeEvent', () => {
  it('shows an actionable toast (not a blocking confirm) for a stage_invite addressed to me', async () => {
    const toast = new ToastService();
    const api = fakeApi();

    await handleRealtimeEvent(
      { type: 'stage_invite', userId: '42' },
      api,
      toast,
      'VR_1_2',
      2,
      42,
      false,
      () => 'Someone',
    );

    const toasts = toast.toasts();
    expect(toasts).toHaveLength(1);
    expect(toasts[0]!.message).toBe('The host invited you to join the stage');
    expect(toasts[0]!.actions).toHaveLength(2);
  });

  it('ignores a stage_invite addressed to a different user', async () => {
    const toast = new ToastService();
    const api = fakeApi();

    await handleRealtimeEvent(
      { type: 'stage_invite', userId: '999' },
      api,
      toast,
      'VR_1_2',
      2,
      42,
      false,
      () => 'Someone',
    );

    expect(toast.toasts()).toHaveLength(0);
  });

  it('accepting the stage_invite toast calls the approval API with approvalType 1', async () => {
    const toast = new ToastService();
    const api = fakeApi();

    await handleRealtimeEvent(
      { type: 'stage_invite', userId: '42' },
      api,
      toast,
      'VR_1_2',
      2,
      42,
      false,
      () => 'Someone',
    );

    const acceptAction = toast.toasts()[0]!.actions!.find((a) => a.label === 'Accept')!;
    acceptAction.run();

    expect(api.stageInviteApproval).toHaveBeenCalledWith('VR_1_2', 2, 3, 1);
  });

  it('declining the stage_invite toast calls the approval API with approvalType 2', async () => {
    const toast = new ToastService();
    const api = fakeApi();

    await handleRealtimeEvent(
      { type: 'stage_invite', userId: '42' },
      api,
      toast,
      'VR_1_2',
      2,
      42,
      false,
      () => 'Someone',
    );

    const declineAction = toast.toasts()[0]!.actions!.find((a) => a.label === 'Decline')!;
    declineAction.run();

    expect(api.stageInviteApproval).toHaveBeenCalledWith('VR_1_2', 2, 3, 2);
  });

  it('shows an actionable toast for a host approving a raised hand', async () => {
    const toast = new ToastService();
    const api = fakeApi();

    await handleRealtimeEvent(
      { type: 'stage_raisehand', userId: '7', raisehandType: 1 },
      api,
      toast,
      'VR_1_2',
      2,
      1,
      true,
      (uid) => (uid === 7 ? 'Sam' : 'Someone'),
    );

    expect(toast.toasts()[0]!.message).toBe('Sam wants to join the stage');
  });

  it('ignores stage_raisehand when the current user is not the host', async () => {
    const toast = new ToastService();
    const api = fakeApi();

    await handleRealtimeEvent(
      { type: 'stage_raisehand', userId: '7', raisehandType: 1 },
      api,
      toast,
      'VR_1_2',
      2,
      1,
      false,
      () => 'Sam',
    );

    expect(toast.toasts()).toHaveLength(0);
  });

  it('shows a self-only toast for stage_kick', async () => {
    const toast = new ToastService();
    const api = fakeApi();

    await handleRealtimeEvent(
      { type: 'stage_kick', userId: '42', managerName: 'Alex', cname: 'VR_1_2' },
      api,
      toast,
      'VR_1_2',
      2,
      42,
      false,
      () => 'Someone',
    );

    expect(toast.toasts()[0]!.message).toBe('You were removed from the stage by Alex');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --include='src/app/features/room/data/handle-realtime-event.util.spec.ts' --watch=false`
Expected: FAIL — current signature still expects a `confirm: ConfirmService` first argument, and uses `confirm.ask()` instead of `toast.action()`.

- [ ] **Step 3: Rewrite `handle-realtime-event.util.ts`**

Replace the full contents of `src/app/features/room/data/handle-realtime-event.util.ts` with:

```ts
import { firstValueFrom } from 'rxjs';
import type { ToastService } from '@core/services/toast.service';
import type { RoomApi } from '@features/room/data/room-api';
import type { RoomRealtimeEvent } from '@core/realtime/room-realtime-events';

export async function handleRealtimeEvent(
  event: RoomRealtimeEvent | null,
  api: RoomApi,
  toast: ToastService,
  cname: string | null,
  busiType: number,
  userId: number,
  isHost: boolean,
  getNickname: (userId: number) => string,
): Promise<void> {
  switch (event?.type) {
    case 'stage_invite': {
      if (Number(event.userId) !== userId || !cname) break;
      toast.action('The host invited you to join the stage', [
        {
          label: 'Accept',
          variant: 'primary',
          run: () => {
            void firstValueFrom(api.stageInviteApproval(cname, busiType, 3, 1)).then(() =>
              toast.success('You joined the stage'),
            );
          },
        },
        {
          label: 'Decline',
          run: () => {
            void firstValueFrom(api.stageInviteApproval(cname, busiType, 3, 2)).then(() =>
              toast.info('Invite declined'),
            );
          },
        },
      ]);
      break;
    }
    case 'mod_invite': {
      if (Number(event.userId) !== userId || !cname) break;
      toast.action('You have been invited to become a moderator', [
        {
          label: 'Accept',
          variant: 'primary',
          run: () => {
            void firstValueFrom(api.approveManager(cname, userId)).then(() =>
              toast.success('You are now a moderator'),
            );
          },
        },
        { label: 'Decline', run: () => {} },
      ]);
      break;
    }
    case 'stage_raisehand': {
      if (!isHost || event.raisehandType !== 1 || !cname) break;
      const raiserId = Number(event.userId);
      const nickname = getNickname(raiserId);
      toast.action(`${nickname} wants to join the stage`, [
        {
          label: 'Approve',
          variant: 'primary',
          run: () => {
            void firstValueFrom(api.raiseHandApproval(cname, busiType, raiserId, 1)).then(() =>
              toast.success(`${nickname} approved`),
            );
          },
        },
        { label: 'Dismiss', run: () => {} },
      ]);
      break;
    }
    case 'stage_kick':
      if (Number(event.userId) === userId) {
        toast.warning(`You were removed from the stage by ${event.managerName}`);
      }
      break;
    case 'stage_device_control':
      if (event.deviceType === 1 && Number(event.userId) === userId) {
        toast.warning('You were muted');
      }
      break;
    case 'mod_unmuted':
      if (Number(event.userId) === userId) {
        toast.success('You can speak now');
      }
      break;
    case 'mod_accepted':
      if (Number(event.userId) === userId) {
        toast.success('You are now a moderator');
      }
      break;
    case 'mod_removed':
      if (Number(event.userId) === userId) {
        toast.warning('You are no longer a moderator');
      }
      break;
    default:
      break;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ng test --include='src/app/features/room/data/handle-realtime-event.util.spec.ts' --watch=false`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/features/room/data/handle-realtime-event.util.ts src/app/features/room/data/handle-realtime-event.util.spec.ts
git commit -m "feat(room): replace blocking confirm modals with actionable toasts"
```

---

### Task 6: Update the one call site in `RoomPageBase`

**Files:**
- Modify: `src/app/features/room/pages/room-page-base.ts:19,59,134-144`

**Interfaces:**
- Consumes: `handleRealtimeEvent(event, api, toast, cname, busiType, userId, isHost, getNickname)` new signature from Task 5.

This task has no new isolated unit test — `RoomPageBase` is an abstract class with no existing spec coverage, and adding component-harness coverage for it is out of proportion to a two-line signature update. Verification is `npx tsc --noEmit` (this task removes a now-nonexistent constructor argument that Task 5's signature change would otherwise break) plus the full test suite from Tasks 1-5 staying green.

- [ ] **Step 1: Remove the `ConfirmService` import and injection**

In `src/app/features/room/pages/room-page-base.ts`, delete this line (line 19):

```ts
import { ConfirmService } from '@core/services/confirm.service';
```

Delete this line (line 59):

```ts
  protected readonly confirm = inject(ConfirmService);
```

- [ ] **Step 2: Update the `handleRealtimeEvent` call**

Replace the call inside `bffEventEffect` (originally lines 134-144):

```ts
    void handleRealtimeEvent(
      event,
      this.confirm,
      this.api,
      this.toast,
      this.roomStore.cname() ?? '',
      this.busiType(),
      this.roomStore.userId(),
      this.roomStore.isHost(),
      (uid) => this.resolveNickname(uid),
    ).catch((err) => console.warn('[bffEventEffect]', err));
```

with:

```ts
    void handleRealtimeEvent(
      event,
      this.api,
      this.toast,
      this.roomStore.cname() ?? '',
      this.busiType(),
      this.roomStore.userId(),
      this.roomStore.isHost(),
      (uid) => this.resolveNickname(uid),
    ).catch((err) => console.warn('[bffEventEffect]', err));
```

- [ ] **Step 3: Verify the whole project typechecks**

Run: `npx tsc --noEmit`
Expected: no errors (confirms no other file in the room feature referenced `this.confirm`, and the new `handleRealtimeEvent` call matches Task 5's signature).

- [ ] **Step 4: Run the full test suite**

Run: `npx ng test --watch=false`
Expected: PASS — all specs from Tasks 1-5 plus any pre-existing specs elsewhere in the project.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/room/pages/room-page-base.ts
git commit -m "refactor(room): drop unused ConfirmService now that invites use actionable toasts"
```

---

## Final verification (after Task 6)

- [ ] `npx tsc --noEmit` — clean
- [ ] `npx ng test --watch=false` — all green
- [ ] Manual smoke check per the `/verify` or `/run` skill: trigger a stage invite while in the target room and confirm exactly one actionable toast appears (no modal, no duplicate), and that tapping Accept/Decline calls the API and shows the expected follow-up toast.
