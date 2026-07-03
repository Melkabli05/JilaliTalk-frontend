# Room Minimize (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an always-visible "minimize" action to the voice room header that shrinks the
room into a draggable floating status bar, keeps the audio connection alive while the user
navigates anywhere else in the app, and restores the full room view on tap — without
persisting across a hard refresh (that's Phase 2, not built here).

**Architecture:** `RoomConnectionService`/`BffRoomSocketService` are already root-scoped
singletons; the only thing stopping them from surviving navigation today is (a) an explicit
page-level re-provider shadowing one of them, and (b) an unconditional teardown on component
destroy. A new slim root store (`ActiveCallStore`) tracks which room is minimized; the
teardown is gated on it, and a new floating bar component (rendered outside the
router-outlet, in `app.ts`) reads it through a `core/`-owned abstraction token.

**Tech Stack:** Angular 22 (zoneless, signals, `@Service()`), `@angular/cdk/drag-drop`
(new — CDK itself is already a dependency, this sub-module is not yet imported anywhere).

## Global Constraints

- Voice room (`RoomPageComponent`) only. `VideoRoomPageComponent` is not touched.
- Only one room can be minimized at a time.
- No comments in any new or modified code — put rationale in commit messages only (explicit
  project preference).
- `StageStore`, `AudienceStore`, `CommentsStore`, `ModStore`, `GiftsStore`, `InRoomRtmStore`,
  `GoodieStore`, `ManagersStore` all remain page-scoped `@Injectable()`/component-provided —
  none of them move to root. Only the connection services (already root) and the new
  `ActiveCallStore` are root-scoped.
- Every component stays `ChangeDetectionStrategy.OnPush`; no `standalone: true` anywhere.
- No hardcoded colors — use design tokens (`var(--color-*)`, `var(--space-*)`, etc.).
- `core/` may not import `store/` directly — any `core/` file needing `ActiveCallStore`
  state goes through the `ACTIVE_CALL_READER` token, bound in `app.config.ts` (mirroring the
  existing `NOTIFICATION_REPORTER`/`ROOM_INVITE_GATEWAY` pattern). `app.ts` and
  `app.config.ts` themselves are composition-root files and may inject `ActiveCallStore`
  directly (same precedent as `app.config.ts` already injecting `NotificationStore`
  directly).

---

## File Structure

- Create: `src/app/store/active-call.store.ts` — the new root store.
- Create: `src/app/store/active-call.store.spec.ts` — its unit tests.
- Create: `src/app/core/tokens/active-call-reader.token.ts` — the `core/`-owned abstraction.
- Modify: `src/app/app.config.ts` — bind `ACTIVE_CALL_READER` to `ActiveCallStore`.
- Create: `src/app/core/layout/minimized-room-bar.component.ts` — the floating draggable bar.
- Modify: `src/app/app.ts` — render the bar, gate it on `ActiveCallStore.minimized()`.
- Modify: `src/app/features/room/pages/room-page-base.ts` — gate the teardown, add
  `onMinimize()`.
- Modify: `src/app/features/room/feature/room-header/room-header.ts` — add the always-visible
  minimize button + `(minimize)` output.
- Modify: `src/app/features/room/pages/room-page.ts` — stop shadowing `RoomConnectionService`,
  wire `(minimize)`, add the restore-without-reconnect branch in `doEnterRoom()`.

---

### Task 1: `ActiveCallStore` + stop shadowing `RoomConnectionService`

**Files:**
- Create: `src/app/store/active-call.store.ts`
- Test: `src/app/store/active-call.store.spec.ts`
- Modify: `src/app/features/room/pages/room-page.ts` (remove `RoomConnectionService` from
  `providers: []` and its now-unused import)

**Interfaces:**
- Produces: `ActiveCallStore` with readonly signals `cname(): string | null`,
  `busiType(): number`, `roomName(): string`, `isMicOn(): boolean`,
  `minimized(): boolean` (computed as `cname() !== null`), and methods
  `minimize(cname: string, busiType: number, roomName: string, isMicOn: boolean): void`,
  `updateMicState(isMicOn: boolean): void`, `clear(): void`. Consumed by every later task.

- [ ] **Step 1: Write the failing tests**

```ts
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { ActiveCallStore } from './active-call.store';

describe('ActiveCallStore', () => {
  let store: ActiveCallStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(ActiveCallStore);
  });

  it('starts with nothing minimized', () => {
    expect(store.minimized()).toBe(false);
    expect(store.cname()).toBeNull();
  });

  it('minimize() sets all fields and flips minimized to true', () => {
    store.minimize('room-123', 2, 'Chill Voice Room', true);
    expect(store.minimized()).toBe(true);
    expect(store.cname()).toBe('room-123');
    expect(store.busiType()).toBe(2);
    expect(store.roomName()).toBe('Chill Voice Room');
    expect(store.isMicOn()).toBe(true);
  });

  it('updateMicState() only changes isMicOn, leaves the rest untouched', () => {
    store.minimize('room-123', 2, 'Chill Voice Room', true);
    store.updateMicState(false);
    expect(store.isMicOn()).toBe(false);
    expect(store.cname()).toBe('room-123');
  });

  it('clear() resets to nothing minimized', () => {
    store.minimize('room-123', 2, 'Chill Voice Room', true);
    store.clear();
    expect(store.minimized()).toBe(false);
    expect(store.cname()).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx ng test --no-watch --include="src/app/store/active-call.store.spec.ts"`
Expected: FAIL — `Cannot find module './active-call.store'` (the file doesn't exist yet).
(Use `ng test`, not raw `vitest run` — raw `vitest` hits a pre-existing `TestBed.initTestEnvironment()` not called error affecting every spec file in the project; `ng test`'s builder initializes TestBed correctly.)

- [ ] **Step 3: Write the store**

```ts
import { Service, signal, computed } from '@angular/core';

@Service()
export class ActiveCallStore {
  private readonly _cname = signal<string | null>(null);
  private readonly _busiType = signal(2);
  private readonly _roomName = signal('');
  private readonly _isMicOn = signal(false);

  readonly cname = this._cname.asReadonly();
  readonly busiType = this._busiType.asReadonly();
  readonly roomName = this._roomName.asReadonly();
  readonly isMicOn = this._isMicOn.asReadonly();
  readonly minimized = computed(() => this._cname() !== null);

  minimize(cname: string, busiType: number, roomName: string, isMicOn: boolean): void {
    this._cname.set(cname);
    this._busiType.set(busiType);
    this._roomName.set(roomName);
    this._isMicOn.set(isMicOn);
  }

  updateMicState(isMicOn: boolean): void {
    this._isMicOn.set(isMicOn);
  }

  clear(): void {
    this._cname.set(null);
  }
}
```

`@Service()` is this codebase's established Angular 22 shorthand for
`@Injectable({ providedIn: 'root' })` — confirmed by reading `src/app/store/notification.store.ts:22`,
the other existing file in this directory.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx ng test --no-watch --include="src/app/store/active-call.store.spec.ts"`
Expected: PASS — 4/4 tests.

- [ ] **Step 5: Stop shadowing `RoomConnectionService`**

In `src/app/features/room/pages/room-page.ts`, remove this import line:

```ts
import { RoomConnectionService } from '@core/realtime/room-connection.service';
```

And change the `providers` array in the `@Component` decorator from:

```ts
providers: [RoomStore, StageStore, AudienceStore, CommentsStore, ModStore, GiftsStore, InRoomRtmStore, GoodieStore, ManagersStore, RoomConnectionService],
```

to:

```ts
providers: [RoomStore, StageStore, AudienceStore, CommentsStore, ModStore, GiftsStore, InRoomRtmStore, GoodieStore, ManagersStore],
```

`RoomConnectionService` is `@Injectable({ providedIn: 'root' })` (confirmed at
`src/app/core/realtime/room-connection.service.ts:8`) — re-listing it here was creating a
fresh, page-scoped instance that shadowed the real root singleton and was destroyed with the
page. Removing it means `inject(RoomConnectionService)` in `RoomPageBase` now resolves to the
actual root singleton, matching how `BffRoomSocketService` already resolves (it was never
re-provided this way).

- [ ] **Step 6: Verify the build**

Run: `npx ng build`
Expected: succeeds with no new errors (no other file references `RoomConnectionService` via
this now-removed import).

- [ ] **Step 7: Commit**

```bash
git add src/app/store/active-call.store.ts src/app/store/active-call.store.spec.ts src/app/features/room/pages/room-page.ts
git commit -m "feat(room): add ActiveCallStore, stop shadowing RoomConnectionService"
```

---

### Task 2: `ACTIVE_CALL_READER` token + `app.config.ts` binding

**Files:**
- Create: `src/app/core/tokens/active-call-reader.token.ts`
- Modify: `src/app/app.config.ts`

**Interfaces:**
- Consumes: `ActiveCallStore` from Task 1 (`cname()`, `busiType()`, `roomName()`,
  `isMicOn()`, `minimized()`, `updateMicState()`, `clear()`).
- Produces: `ACTIVE_CALL_READER: InjectionToken<ActiveCallReader>`, where
  `ActiveCallReader` is `{ snapshot: Signal<ActiveCallSnapshot | null>; updateMicState(isMicOn: boolean): void; clear(): void; }`
  and `ActiveCallSnapshot` is `{ cname: string; busiType: number; roomName: string; isMicOn: boolean; }`.
  Consumed by Task 5's `MinimizedRoomBarComponent`.

- [ ] **Step 1: Create the token**

```ts
import { InjectionToken, Signal, signal } from '@angular/core';

export interface ActiveCallSnapshot {
  readonly cname: string;
  readonly busiType: number;
  readonly roomName: string;
  readonly isMicOn: boolean;
}

export interface ActiveCallReader {
  readonly snapshot: Signal<ActiveCallSnapshot | null>;
  updateMicState(isMicOn: boolean): void;
  clear(): void;
}

export const ACTIVE_CALL_READER = new InjectionToken<ActiveCallReader>('ACTIVE_CALL_READER', {
  factory: () => ({
    snapshot: signal<ActiveCallSnapshot | null>(null),
    updateMicState: () => {},
    clear: () => {},
  }),
});
```

This mirrors `src/app/core/tokens/notification-reporter.token.ts` exactly: an interface
`core/` owns, plus a safe no-op default factory, bound to the real implementation only in
`app.config.ts` — because `core/` may not import `store/` directly (CLAUDE.md §2).

- [ ] **Step 2: Bind it in `app.config.ts`**

Add these two imports to `src/app/app.config.ts`:

```ts
import { ACTIVE_CALL_READER } from '@core/tokens/active-call-reader.token';
import { ActiveCallStore } from '@store/active-call.store';
```

Add `computed` to the existing `@angular/core` import line (currently
`import { ApplicationConfig, ErrorHandler, provideZonelessChangeDetection, APP_INITIALIZER, inject, EnvironmentProviders } from '@angular/core';`)
so it reads:

```ts
import { ApplicationConfig, ErrorHandler, provideZonelessChangeDetection, APP_INITIALIZER, inject, computed, EnvironmentProviders } from '@angular/core';
```

Add this entry to the `providers: [...]` array, alongside the existing
`NOTIFICATION_REPORTER`/`ROOM_INVITE_GATEWAY` bindings:

```ts
{
  provide: ACTIVE_CALL_READER,
  useFactory: () => {
    const store = inject(ActiveCallStore);
    return {
      snapshot: computed(() =>
        store.minimized()
          ? { cname: store.cname()!, busiType: store.busiType(), roomName: store.roomName(), isMicOn: store.isMicOn() }
          : null,
      ),
      updateMicState: (v: boolean) => store.updateMicState(v),
      clear: () => store.clear(),
    };
  },
},
```

- [ ] **Step 3: Verify the build**

Run: `npx ng build`
Expected: succeeds with no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/core/tokens/active-call-reader.token.ts src/app/app.config.ts
git commit -m "feat(room): add ACTIVE_CALL_READER token bound to ActiveCallStore"
```

---

### Task 3: Gate the teardown, add `onMinimize()` to `RoomPageBase`

**Files:**
- Modify: `src/app/features/room/pages/room-page-base.ts`

**Interfaces:**
- Consumes: `ActiveCallStore` from Task 1.
- Produces: `RoomPageBase.onMinimize(): void` — consumed by Task 4's room-header wiring and
  Task 6's `doEnterRoom()` restore branch (which reads `this.activeCallStore` via the same
  protected field added here).

- [ ] **Step 1: Add the imports and injected fields**

In `src/app/features/room/pages/room-page-base.ts`, add to the top imports:

```ts
import { Location } from '@angular/common';
import { ActiveCallStore } from '@store/active-call.store';
```

Add these two protected fields alongside the other `inject(...)` calls (near
`protected readonly router = inject(Router);`):

```ts
  protected readonly activeCallStore = inject(ActiveCallStore);
  protected readonly location = inject(Location);
```

- [ ] **Step 2: Gate the teardown**

Replace the constructor's `destroyRef.onDestroy(...)` block — currently:

```ts
  constructor() {
    this.destroyRef.onDestroy(() => {
      this._destroying.set(true);
      this.typingPruneSub?.unsubscribe();
      this.rcs.leave().catch(() => {}).finally(() =>
        this.roomStore.leaveRoom().finally(() => {
          this.stageStore.reset();
          this.audienceStore.reset();
          this.commentsStore.reset();
          this.rtmStore.reset();
          this.giftsStore.reset();
          this.modStore.reset();
          this.goodieStore.endGame();
        }),
      );
    });

    this.typingPruneSub = interval(1_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.typingTick.update((n) => n + 1));
  }
```

with:

```ts
  constructor() {
    this.destroyRef.onDestroy(() => {
      this._destroying.set(true);
      this.typingPruneSub?.unsubscribe();
      if (this.activeCallStore.cname() !== null && this.activeCallStore.cname() === this.roomStore.cname()) {
        return;
      }
      this.rcs.leave().catch(() => {}).finally(() =>
        this.roomStore.leaveRoom().finally(() => {
          this.stageStore.reset();
          this.audienceStore.reset();
          this.commentsStore.reset();
          this.rtmStore.reset();
          this.giftsStore.reset();
          this.modStore.reset();
          this.goodieStore.endGame();
        }),
      );
    });

    this.typingPruneSub = interval(1_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.typingTick.update((n) => n + 1));
  }
```

The `activeCallStore.cname() !== null` check matters: without it, if nothing is minimized,
both sides of the comparison could coincidentally be equal in some edge state and wrongly
skip the teardown. Requiring a real cname on the store side makes the guard only fire when
something is actually minimized.

- [ ] **Step 3: Add `onMinimize()`**

Add this method right after `onLeave()` (which ends at line 361 in the current file):

```ts
  onMinimize(): void {
    const cname = this.roomStore.cname();
    if (!cname) return;
    this.activeCallStore.minimize(cname, this.roomStore.busiType(), this.roomStore.name(), this.roomStore.isMicOn());
    if (typeof window !== 'undefined' && window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/rooms/voice']);
    }
  }
```

- [ ] **Step 4: Verify the build**

Run: `npx ng build`
Expected: succeeds with no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/room/pages/room-page-base.ts
git commit -m "feat(room): gate teardown on minimize, add onMinimize()"
```

---

### Task 4: Minimize button in `room-header.ts`, wired in `room-page.ts`

**Files:**
- Modify: `src/app/features/room/feature/room-header/room-header.ts`
- Modify: `src/app/features/room/pages/room-page.ts`

**Interfaces:**
- Produces: `RoomHeaderComponent.minimize: OutputEmitterRef<void>` — a new output, matching
  the existing `readonly leave = output<void>();` pattern at line 1121 of the current file.

- [ ] **Step 1: Add the icon import**

In `src/app/features/room/feature/room-header/room-header.ts`, add `LucideMinimize2` to the
existing `@lucide/angular` import (currently ending `..., LucideEllipsisVertical, LucideX,`):

```ts
  LucideEllipsisVertical,
  LucideX,
  LucideMinimize2,
} from '@lucide/angular';
```

Add `LucideMinimize2` to the component's own `imports: [...]` array as well (wherever the
other `Lucide*` icons are listed there).

- [ ] **Step 2: Add the output and handler**

Add this line next to `readonly leave = output<void>();` (line 1121):

```ts
  readonly minimize = output<void>();
```

Add this method next to `onLeave()` (line 1219):

```ts
  onMinimize(): void {
    this.minimize.emit();
  }
```

- [ ] **Step 3: Add the button to the template**

In the same file's template, immediately before the existing `<div class="toolbar-sep hide-mobile"></div>`
that precedes the "Leave room" button (around line 316), insert a new always-visible button
(no `hide-mobile` class — this must stay visible at every width):

```html
        <button
          class="toolbar-btn"
          appTooltip="Minimize"
          tooltipPosition="left"
          (click)="onMinimize()"
          aria-label="Minimize room"
        >
          <svg aria-hidden="true" lucideMinimize2 [size]="18"></svg>
        </button>

        <div class="toolbar-sep hide-mobile"></div>

        <button
          class="toolbar-btn danger"
          appTooltip="Leave room"
          tooltipPosition="left"
          (click)="onLeave()"
          aria-label="Leave room"
        >
          <svg aria-hidden="true" lucideLogOut [size]="18"></svg>
        </button>
```

- [ ] **Step 4: Wire it in `room-page.ts`**

In `src/app/features/room/pages/room-page.ts`'s template, add `(minimize)="onMinimize()"`
to the `<app-room-header ... />` tag, next to the existing `(leave)="onLeave()"`:

```html
          (refresh)="onRefreshRoom()"
          (leave)="onLeave()"
          (minimize)="onMinimize()"
        />
```

`onMinimize()` itself needs no new definition here — it's inherited from `RoomPageBase`
(Task 3).

- [ ] **Step 5: Verify the build**

Run: `npx ng build`
Expected: succeeds with no new errors.

- [ ] **Step 6: Manual check**

Run `npm start`, join a voice room, confirm the new minimize button (an icon between the
existing toolbar buttons and the red "Leave room" button, visible at every viewport width)
is present and clicking it navigates away without visibly breaking anything (the floating
bar itself doesn't exist until Task 5, so at this point clicking it should just navigate
back with no visible confirmation — that's expected for this task).

- [ ] **Step 7: Commit**

```bash
git add src/app/features/room/feature/room-header/room-header.ts src/app/features/room/pages/room-page.ts
git commit -m "feat(room-header): add always-visible minimize button"
```

---

### Task 5: `MinimizedRoomBarComponent` + `app.ts` wiring

**Files:**
- Create: `src/app/core/layout/minimized-room-bar.component.ts`
- Modify: `src/app/app.ts`

**Interfaces:**
- Consumes: `ACTIVE_CALL_READER` from Task 2; `ActiveCallStore` from Task 1 (in `app.ts`
  only, per the Global Constraints composition-root exception).
- Produces: `<app-minimized-room-bar />`, rendered in `app.ts` when
  `activeCallStore.minimized()` is true.

- [ ] **Step 1: Create the component**

```ts
import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CdkDrag } from '@angular/cdk/drag-drop';
import { LucideMic, LucideMicOff } from '@lucide/angular';
import { RoomConnectionService } from '@core/realtime/room-connection.service';
import { ACTIVE_CALL_READER } from '@core/tokens/active-call-reader.token';

@Component({
  selector: 'app-minimized-room-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkDrag, LucideMic, LucideMicOff],
  template: `
    @if (snapshot(); as call) {
      <div class="minimized-bar" cdkDrag cdkDragBoundary=".app-shell">
        <button type="button" class="restore-area" (click)="restore(call.cname, call.busiType)">
          <span class="room-name">{{ call.roomName }}</span>
        </button>
        <button
          type="button"
          class="mic-toggle"
          [attr.aria-label]="call.isMicOn ? 'Mute microphone' : 'Unmute microphone'"
          (click)="toggleMic(call.isMicOn)"
        >
          @if (call.isMicOn) {
            <svg aria-hidden="true" lucideMic [size]="16"></svg>
          } @else {
            <svg aria-hidden="true" lucideMicOff [size]="16"></svg>
          }
        </button>
      </div>
    }
  `,
  styles: [`
    :host {
      display: contents;
    }
    .minimized-bar {
      position: fixed;
      left: var(--space-4);
      bottom: calc(var(--bottom-nav-height) + var(--space-4) + env(safe-area-inset-bottom));
      z-index: var(--z-modal);
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-full);
      background: var(--color-card);
      box-shadow: var(--shadow-lg);
      border: 1px solid var(--color-border);
      touch-action: none;
      cursor: grab;
    }
    .minimized-bar:active {
      cursor: grabbing;
    }
    @media (min-width: 1024px) {
      .minimized-bar {
        bottom: var(--space-4);
      }
    }
    .restore-area {
      display: flex;
      align-items: center;
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
    }
    .room-name {
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--color-text);
      max-width: 140px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .mic-toggle {
      display: flex;
      align-items: center;
      justify-content: center;
      width: var(--space-9);
      height: var(--space-9);
      border-radius: var(--radius-full);
      border: none;
      background: var(--color-neutral-100);
      color: var(--color-text);
      cursor: pointer;
    }
    :host-context(.dark) .minimized-bar {
      background: var(--color-neutral-800);
      border-color: var(--color-neutral-700);
    }
    :host-context(.dark) .mic-toggle {
      background: var(--color-neutral-700);
    }
  `],
})
export class MinimizedRoomBarComponent {
  private readonly router = inject(Router);
  private readonly rcs = inject(RoomConnectionService);
  private readonly activeCall = inject(ACTIVE_CALL_READER);

  readonly snapshot = this.activeCall.snapshot;

  restore(cname: string, busiType: number): void {
    void this.router.navigate(['/room', cname, busiType]);
  }

  toggleMic(isCurrentlyOn: boolean): void {
    void this.rcs.setMicEnabled(!isCurrentlyOn).then(() => {
      this.activeCall.updateMicState(!isCurrentlyOn);
    });
  }
}
```

This component has `ViewEncapsulation`'s default (Emulated), unlike `header.component.ts`/
`sidenav.component.ts` — so `:host-context(.dark)` here is correctly processed by Angular
(the `ViewEncapsulation.None` bug found and fixed earlier this session doesn't apply; this
component doesn't set `encapsulation: ViewEncapsulation.None`).

- [ ] **Step 2: Wire it into `app.ts`**

Add these imports to `src/app/app.ts`:

```ts
import { ActiveCallStore } from '@store/active-call.store';
import { MinimizedRoomBarComponent } from '@core/layout/minimized-room-bar.component';
```

Add `MinimizedRoomBarComponent` to the `imports: [...]` array in the `@Component` decorator
(currently `imports: [RouterOutlet, SidenavComponent, HeaderComponent, ToastContainerComponent, PwaUpdateBannerComponent]`).

Add this field to the `App` class, alongside the other `inject(...)` calls:

```ts
  protected readonly activeCallStore = inject(ActiveCallStore);
```

In the template, add the bar as a sibling to `<app-toast-container />`:

```html
    <app-toast-container />
    @if (activeCallStore.minimized()) {
      <app-minimized-room-bar />
    }
    @if (pwaUpdate.updateAvailable()) {
      <app-pwa-update-banner />
    }
```

- [ ] **Step 3: Verify the build**

Run: `npx ng build`
Expected: succeeds with no new errors.

- [ ] **Step 4: Manual check**

Run `npm start`, join a voice room, click minimize. Confirm: the floating bar appears
showing the room name, is draggable within the viewport (doesn't go fully off-screen), the
mic toggle button changes icon on click, and tapping the room name area navigates back into
`/room/:cname/:busiType`. Confirm the bar disappears once you're back in the full room view
(handled fully by Task 6 — at this point in the plan, tapping to restore will re-trigger a
full fresh join rather than a seamless restore, which is expected until Task 6 lands).

- [ ] **Step 5: Commit**

```bash
git add src/app/core/layout/minimized-room-bar.component.ts src/app/app.ts
git commit -m "feat(shell): add draggable MinimizedRoomBarComponent"
```

---

### Task 6: Restore without reconnecting

**Files:**
- Modify: `src/app/features/room/pages/room-page.ts`

**Interfaces:**
- Consumes: `this.activeCallStore` (available via `RoomPageBase` since Task 3).
- Produces: nothing new externally — this is an internal behavior change to `doEnterRoom()`.

- [ ] **Step 1: Replace `doEnterRoom()`**

Replace the entire current method body in `src/app/features/room/pages/room-page.ts` — from
`private async doEnterRoom(cname: string, busiType: number): Promise<void> {` through its
closing `}` — with:

```ts
  private async doEnterRoom(cname: string, busiType: number): Promise<void> {
    const visible = this.visible();
    this.audienceStore.setBusiType(busiType);

    const isRestore = this.activeCallStore.cname() === cname;
    if (this.activeCallStore.minimized() && !isRestore) {
      await this.rcs.leave().catch(() => {});
      this.activeCallStore.clear();
    }

    if (!isRestore) {
      try {
        await this.roomStore.joinRoom(cname, busiType, visible);
      } catch (err) {
        if (err instanceof JoinCancelledError) {
          await this.router.navigate(this.leaveNavTarget);
          await this.roomStore.leaveRoom();
          this.stageStore.reset();
          this.audienceStore.reset();
          return;
        }
        throw err;
      }
    }

    let voiceInfo: VoiceRoomInfo;
    let stage: StageUsersResponse | undefined;
    let audience: AudienceUsersResponse | undefined;
    let comments: CommentsResponse | undefined;
    try {
      const bundle = await firstValueFrom(this.api.fetchJoinBundle<VoiceRoomInfo>(cname, busiType));
      voiceInfo = bundle.voiceRoomInfo;
      stage = bundle.stageUsers;
      audience = bundle.audienceUsers;
      comments = bundle.comments;
    } catch {
      await this.router.navigate(['/']);
      this.toast.error('Room not found. Please create a new one.');
      return;
    }

    const ch = voiceInfo.channelInfo;
    this.roomStore.setCname(cname);
    this.roomStore.setRoomName(ch?.name?.trim() ?? '');
    this.roomStore.setRoomTopic(ch?.topic ?? '');
    this.roomStore.setRtcInfo(ch?.rtcInfo ?? null);
    this.roomStore.setRoomLevelInfo(voiceInfo.roomLevelInfo ?? null);
    const reqUser = voiceInfo.reqUserInfo;
    if (reqUser?.userId) {
      this.reqUserId.set(reqUser.userId);
      this.roomStore.setUserId(reqUser.userId);
      this.commentsStore.setCurrentUserId(reqUser.userId);
    }
    if (reqUser?.role) this.roomStore.setRole(reqUser.role);
    if (reqUser?.base?.nickname) this.roomStore.setNickname(reqUser.base.nickname);
    if (reqUser?.base?.headUrl) this.roomStore.setHeadUrl(reqUser.base.headUrl);
    if (reqUser?.base?.nationality) this.roomStore.setNationality(reqUser.base.nationality);

    if (isRestore) {
      this.roomStore.setMicOn(this.activeCallStore.isMicOn());
    }

    const isVisible = this.roomStore.isVisible();

    if (!isRestore) {
      const heartbeatHostId = isVisible ? (voiceInfo.hostInfo?.userId ?? 0) : 0;
      this.bffWs.connect(cname, heartbeatHostId, busiType, voiceInfo.configInfo?.heartbeatSecond ?? null);
    }

    const uid = this.roomStore.userId();

    if (isVisible) this.audienceStore.setCname(cname);
    this.stageStore.updateStageUsers([...(stage?.list ?? [])]);
    this.audienceStore.updateAudienceUsers([...(audience?.list ?? [])]);
    this.commentsStore.updateComments([...(comments?.items ?? [])]);

    this.rtmStore.setCurrentUid(uid);

    if (!isRestore) {
      try {
        const rtcInfo = this.roomStore.rtcInfo();
        const rtcToken = rtcInfo?.token ?? null;
        const appId = rtcInfo?.appId?.trim() ? rtcInfo.appId : environment.agoraAppIdVoice;
        await this.rcs.connect(cname, uid, rtcToken, appId, !isVisible);
      } catch {
        this.toast.error('Failed to connect to audio');
      }

      try {
        await this.rcs.connectRtm(uid);
        await this.rcs.subscribeRtmChannel(cname);
      } catch {
      }
    }

    if (isRestore) {
      this.activeCallStore.clear();
    }
  }
```

This keeps every existing behavior for a normal fresh join (`isRestore` is `false` whenever
`activeCallStore.cname()` is `null` or doesn't match, which is the case for every join today)
and adds three new branches:
1. If a *different* room is currently minimized, leave it and clear the store before
   proceeding with an entirely normal join of the new room.
2. If *this exact* room is the one minimized (the user tapped the bar to restore), skip
   `roomStore.joinRoom(...)`, `bffWs.connect(...)`, `rcs.connect(...)`, and the RTM
   connect/subscribe calls — the connection, websocket, and RTM channel are all still alive —
   but still fetch the join bundle and repopulate `RoomStore`/`StageStore`/`AudienceStore`/
   `CommentsStore` fresh, since those were destroyed when the page unmounted on minimize.
3. Restore the mic on/off state from `ActiveCallStore` (the only piece of `RoomStore` state
   that could have changed while minimized, via the floating bar's own mic toggle) and clear
   `ActiveCallStore` once the restore completes.

- [ ] **Step 2: Verify the build**

Run: `npx ng build`
Expected: succeeds with no new errors.

- [ ] **Step 3: Manual check**

Run `npm start`, join a voice room, note the connected state (e.g. another participant's
audio, or your own mic status). Minimize. Toggle mic via the floating bar. Navigate to
`/rooms/voice`, then `/messages`. Tap the floating bar to restore — confirm: no audio
glitch/reconnect sound, the mic toggle state from the bar is reflected in the full view, the
floating bar disappears, and stage/audience/comments show current data (not stale from
before minimizing). Then click "Leave" — confirm the connection actually ends this time (the
floating bar must not reappear, and rejoining fresh afterward should behave like a normal
first join).

Separately: join room A, minimize it, then navigate directly to a *different* room B's URL
(simulating the "join a second room while one is minimized" case) — confirm room A's
connection is silently ended and room B joins normally, with no floating bar for room A left
behind.

- [ ] **Step 4: Commit**

```bash
git add src/app/features/room/pages/room-page.ts
git commit -m "feat(room): restore from minimize without rejoining or reconnecting"
```

---

### Task 7: Full integration verification

**Files:** none (verification only).

**Interfaces:** N/A.

- [ ] **Step 1: Full test suite**

Run: `npx ng test --no-watch`
Expected: all tests pass, including the 4 new `ActiveCallStore` tests from Task 1.

- [ ] **Step 2: Full production build**

Run: `npx ng build --configuration production`
Expected: succeeds with no errors.

- [ ] **Step 3: Full stylelint pass**

Run: `npm run lint:styles`
Expected: only the 2 pre-existing, unrelated errors in `src/styles/tokens.scss` (not
introduced by this plan) — no new violations.

- [ ] **Step 4: Combined manual walkthrough**

Run `npm start`. At both a mobile width (~375px) and desktop width (≥1024px):
1. Join a room, minimize, drag the floating bar to a few different screen positions
   (including near the mobile bottom-nav and, on mobile, the notch/safe-area top) — confirm
   it never goes fully off-screen and never overlaps the bottom nav uncomfortably.
2. Browse to `/rooms/voice`, `/rooms/live`, `/messages`, `/profile` while minimized — confirm
   the bar persists across every navigation and audio keeps flowing throughout.
3. Restore, confirm the full room reappears correctly with fresh stage/audience/comments.
4. Leave for real — confirm the connection actually ends and the bar never reappears
   spuriously afterward.
5. Repeat step 1-4 in dark mode.

- [ ] **Step 5: Final commit (if any fixups were needed)**

If the manual walkthrough surfaced any issues, fix them and commit each fix individually
with a message describing what was wrong. If nothing needed fixing, this task requires no
commit.
