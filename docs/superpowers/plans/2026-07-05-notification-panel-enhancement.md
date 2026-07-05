# Notification Panel Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Per user instruction, this plan skips writing new unit tests.** Each task verifies via `tsc --noEmit` (and, where noted, a manual behavior check) instead of a spec file. Task 9 still runs the pre-existing test suite as a regression gate — that suite is not being skipped, only the *authoring of new tests* for this feature.

**Goal:** Enhance the notification panel (`shared/ui/notification-panel/`) with day-grouping, relative time, type filter tabs, a mobile bottom-sheet layout with swipe-to-dismiss + undo, and a live-arrival preview toast — per `docs/superpowers/specs/2026-07-05-notification-panel-enhancement-design.md`.

**Architecture:** Split the current monolithic `NotificationPanelComponent` into a thin shell plus four dumb, reusable child components (`NotificationFilterTabsComponent`, `NotificationDayGroupComponent`, `NotificationItemComponent`, `NotificationToastComponent`). All notification-shaped types move to a co-located `notification.model.ts` so `shared/ui/` no longer imports value types from `store/` (CLAUDE.md §2 downward-dependency rule). `NotificationStore` gains filter/grouping/undo/toast state; all new timers (undo-commit, toast auto-dismiss) live in the store, mirroring the existing `ToastService` pattern, not in components.

**Tech Stack:** Angular 22 (signals, `input()`/`output()`, `@if`/`@for`, zoneless), `@lucide/angular` icons, existing design tokens (`--color-*`, `--space-*`, `--radius-*`, `--shadow-*`, `--z-toast`).

## Global Constraints

- Notification cap: **100** stored notifications; `add()`/`addUserEvent()` drop the oldest past this.
- Undo window: **8000ms** after a remove request, before it's permanently deleted.
- Toast preview auto-dismiss: **4000ms**, only shown when `store.isOpen()` is `false` at the moment a notification is added.
- Swipe-to-dismiss (item): **72px** leftward threshold to commit, **10px** slop before a gesture counts as "swiped" (suppresses the subsequent synthetic click).
- Mobile bottom-sheet breakpoint: **`(max-width: 768px)`**.
- Sheet swipe-down-to-close threshold: **80px** (matches the existing precedent in `features/room/feature/room-header/room-header.ts`'s overflow menu).
- Mark-read-on-open marks **every** notification read (same as the existing "Mark all read" button), not just the currently-filtered subset — switching filters must never leave a stale unread badge.
- Every removal path (swipe gesture and the existing hover ✕ button) goes through the **same** `store.requestRemove(id)` — one removal semantic, always undoable.
- No `standalone: true` on any new component (implicit default per this codebase's convention). `ChangeDetectionStrategy.OnPush` on every component. No manual `.subscribe()` anywhere in this plan.
- Path aliases: `@shared/*`, `@store/*`, `@core/*` (see `tsconfig.json`).
- This codebase uses `@Service()` (not `@Injectable()`) for its root-provided stores/services — `NotificationStore` already uses it; keep it.
- **No new unit test files for this feature** (user instruction). Verify each task with `tsc --noEmit`; Task 9 runs the existing suite unmodified as a regression check.

## Deviations from the design spec (discovered while exploring the codebase)

The spec (§5, §7 of the design doc) called for a few things that, on inspection of the actual codebase, have simpler or already-solved equivalents. Each is a "follow established patterns" call, not a scope change:

1. **No new `RelativeTimePipe`.** `shared/utils/relative-time.util.ts` already exists with full test coverage (`relativeTime(ts): string`, covering "now"/"5m"/"3h"/"Yesterday"/"Jun 12"/"Jun 12, 24"). It already exceeds the spec's "within a day" scope. `NotificationItemComponent` imports and calls it directly as a plain function — no pipe wrapper needed.
2. **No CDK `BreakpointObserver`/`A11yModule`/`cdkTrapFocus`.** This codebase already has two proven, dependency-light patterns for exactly this shape of problem, both in `app.ts` and `features/room/feature/room-header/room-header.ts`: (a) mobile-breakpoint detection via `window.matchMedia(...)` + a `change` listener, cleaned up via `DestroyRef`, guarded by `isPlatformBrowser` for SSR; (b) a custom bottom-sheet overlay (backdrop + panel sliding up, drag handle, `touchstart`/`touchmove`/`touchend` swipe-to-close at an 80px threshold) with manual focus management (focus the panel on open, restore focus on close) instead of CDK's `cdkTrapFocusAutoCapture` (that CDK directive is reserved in this codebase for actual `Dialog`-opened modals, e.g. `modal.component.ts`/`confirm-dialog.component.ts` — the notification panel is a self-managed overlay like the room-header's overflow menu, not a `Dialog.open()` call, so it follows that precedent instead). Task 7 below implements this using `window.matchMedia` and manual touch handlers, matching both existing patterns exactly.
3. **Toast auto-dismiss timer lives in the store, not the component.** `ToastService.enqueue()` already arms its own `setTimeout` internally and the component just renders state — no `effect()`/`DestroyRef` timer bookkeeping in the component. `NotificationStore.maybeShowToast()` mirrors this exactly, making `NotificationToastComponent` (Task 6) a two-line dumb template with zero lifecycle code.
4. **`markRead(id)` is deleted, not kept.** Its only caller was the old per-item click handler, which mark-read-on-open replaces. Nothing else in the codebase calls it (confirmed via grep). Per CLAUDE.md, code confirmed unused is deleted, not left as unreachable API surface.
5. **`NotificationListComponent` (mentioned as a possible file in the design's first draft) does not exist as a separate file** — the day-group component iterates items directly; a pass-through wrapper component would have added a file with no behavior of its own.

---

## Task 1: Notification model + day-bucket util (foundation)

**Files:**
- Create: `src/app/shared/utils/day-bucket.util.ts`
- Create: `src/app/shared/ui/notification-panel/notification.model.ts`
- Modify: `src/app/store/notification.store.ts` (swap the top of the file to import types from the new model, instead of declaring them)

**Interfaces:**
- Produces: `DayBucket` type, `DAY_BUCKET_LABELS: Record<DayBucket, string>`, `bucketForTimestamp(ts: number, now: number): DayBucket` — from `day-bucket.util.ts`.
- Produces: `AppNotification`, `NotificationType`, `NotificationFilter`, `NotificationGroup`, `UndoEntry` interfaces/types — from `notification.model.ts`.
- Consumes: nothing (Task 1 has no dependencies on other tasks).

- [ ] **Step 1: Create the day-bucket utility**

Create `src/app/shared/utils/day-bucket.util.ts`:

```ts
export type DayBucket = 'today' | 'yesterday' | 'this-week' | 'earlier';

export const DAY_BUCKET_LABELS: Record<DayBucket, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  'this-week': 'This week',
  earlier: 'Earlier',
};

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Buckets a timestamp into a day-group relative to `now`, using local calendar days
 *  (not rolling 24h windows) so "Yesterday" means the previous calendar day, not
 *  "24-48 hours ago". */
export function bucketForTimestamp(ts: number, now: number): DayBucket {
  const daysAgo = Math.round((startOfDay(now) - startOfDay(ts)) / DAY_MS);
  if (daysAgo <= 0) return 'today';
  if (daysAgo === 1) return 'yesterday';
  if (daysAgo <= 7) return 'this-week';
  return 'earlier';
}
```

- [ ] **Step 2: Create the notification model file**

Create `src/app/shared/ui/notification-panel/notification.model.ts`:

```ts
import type { DayBucket } from '@shared/utils/day-bucket.util';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export type NotificationFilter = 'all' | 'unread' | NotificationType;

export interface AppNotification {
  readonly id: string;
  readonly type: NotificationType;
  readonly title: string;
  readonly message?: string;
  readonly timestamp: number;
  readonly read: boolean;
  /** Set for user-linked notifications (e.g. profile visits) to enable avatar rendering
   *  and click-to-user-profile in the notification panel. */
  readonly userId?: number;
  readonly avatarUrl?: string | null;
  readonly nickname?: string | null;
}

export interface NotificationGroup {
  readonly bucket: DayBucket;
  readonly label: string;
  readonly items: readonly AppNotification[];
}

export interface UndoEntry {
  readonly notification: AppNotification;
  readonly expiresAt: number;
}
```

- [ ] **Step 3: Point the store at the new model file**

In `src/app/store/notification.store.ts`, replace the top of the file (everything from the imports through the `STORAGE_KEY` constant, i.e. the old `export type NotificationType`/`export interface AppNotification` block) with:

```ts
import { Service, effect, inject, signal, computed } from '@angular/core';
import { StorageService } from '@core/services/storage.service';
import { bucketForTimestamp, DAY_BUCKET_LABELS } from '@shared/utils/day-bucket.util';
import type {
  AppNotification,
  NotificationFilter,
  NotificationGroup,
  NotificationType,
  UndoEntry,
} from '@shared/ui/notification-panel/notification.model';

export type { AppNotification, NotificationType, NotificationFilter, NotificationGroup, UndoEntry };

const STORAGE_KEY = 'jtl_notifications';
```

Leave the rest of the file (the `@Service()` class body) untouched for now — Task 2 rewrites it in full.

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no new errors introduced by this step. (`notification-panel.component.ts` still imports `AppNotification` from `@store/notification.store`, which still re-exports it, so this should be clean.)

- [ ] **Step 5: Commit**

```bash
git add src/app/shared/utils/day-bucket.util.ts src/app/shared/ui/notification-panel/notification.model.ts src/app/store/notification.store.ts
git commit -m "$(cat <<'EOF'
refactor(notifications): extract notification types and day-bucket util

Moves AppNotification/NotificationType out of the store into a co-located
model file so shared/ui components can depend on them without importing
store/ (CLAUDE.md's downward-dependency rule). Adds a pure day-bucketing
helper for the upcoming grouped notification list.
EOF
)"
```

---

## Task 2: Extend `NotificationStore` — filter, grouping, undo, toast preview, cap

**Files:**
- Modify: `src/app/store/notification.store.ts` (full rewrite of the class body)

**Interfaces:**
- Consumes: `bucketForTimestamp`, `DAY_BUCKET_LABELS` from Task 1's `day-bucket.util.ts`; `AppNotification`, `NotificationFilter`, `NotificationGroup`, `UndoEntry` from Task 1's `notification.model.ts`.
- Produces (new public API used by Tasks 3-7):
  - `store.filter: Signal<NotificationFilter>`
  - `store.visibleItems: Signal<readonly AppNotification[]>`
  - `store.groupedItems: Signal<readonly NotificationGroup[]>`
  - `store.filterCounts: Signal<Record<NotificationFilter, number>>`
  - `store.undoEntry: Signal<UndoEntry | null>`
  - `store.pendingToast: Signal<AppNotification | null>`
  - `store.setFilter(filter: NotificationFilter): void`
  - `store.requestRemove(id: string): void`
  - `store.undoRemove(): void`
  - `store.dismissToast(): void`
  - `store.remove(id: string): void` (kept, now only called internally by the undo-timer commit)
  - `store.markAllRead(): void` (unchanged, now also what "mark read on open" calls)
  - `store.add(...)` / `store.addUserEvent(...)` (same signatures, now cap at 100 and may set `pendingToast`)
  - **Removed:** `store.markRead(id)` (dead code — see "Deviations" above)

- [ ] **Step 1: Rewrite the store**

Replace the full contents of `src/app/store/notification.store.ts` with:

```ts
import { Service, effect, inject, signal, computed } from '@angular/core';
import { StorageService } from '@core/services/storage.service';
import { bucketForTimestamp, DAY_BUCKET_LABELS } from '@shared/utils/day-bucket.util';
import type {
  AppNotification,
  NotificationFilter,
  NotificationGroup,
  NotificationType,
  UndoEntry,
} from '@shared/ui/notification-panel/notification.model';

export type { AppNotification, NotificationType, NotificationFilter, NotificationGroup, UndoEntry };

const STORAGE_KEY = 'jtl_notifications';
const MAX_NOTIFICATIONS = 100;
const UNDO_WINDOW_MS = 8000;
const TOAST_PREVIEW_MS = 4000;

@Service()
export class NotificationStore {
  private readonly storage = inject(StorageService);

  private readonly _notifications = signal<AppNotification[]>(
    this.storage.get<AppNotification[]>(STORAGE_KEY) ?? [],
  );
  private readonly _isOpen = signal(false);
  private readonly _filter = signal<NotificationFilter>('all');
  private readonly _undoEntry = signal<UndoEntry | null>(null);
  private readonly _pendingToast = signal<AppNotification | null>(null);

  private undoTimer: ReturnType<typeof setTimeout> | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  readonly notifications = this._notifications.asReadonly();
  readonly isOpen = this._isOpen.asReadonly();
  readonly filter = this._filter.asReadonly();
  readonly undoEntry = this._undoEntry.asReadonly();
  readonly pendingToast = this._pendingToast.asReadonly();
  readonly unreadCount = computed(() => this._notifications().filter(n => !n.read).length);
  readonly hasNotifications = computed(() => this._notifications().length > 0);

  readonly visibleItems = computed<readonly AppNotification[]>(() => {
    const hiddenId = this._undoEntry()?.notification.id;
    const filter = this._filter();
    return this._notifications().filter(n => {
      if (n.id === hiddenId) return false;
      if (filter === 'all') return true;
      if (filter === 'unread') return !n.read;
      return n.type === filter;
    });
  });

  readonly groupedItems = computed<readonly NotificationGroup[]>(() => {
    const now = Date.now();
    const buckets = new Map<NotificationGroup['bucket'], AppNotification[]>();
    for (const item of this.visibleItems()) {
      const bucket = bucketForTimestamp(item.timestamp, now);
      const existing = buckets.get(bucket);
      if (existing) existing.push(item);
      else buckets.set(bucket, [item]);
    }
    const order: NotificationGroup['bucket'][] = ['today', 'yesterday', 'this-week', 'earlier'];
    return order
      .filter(bucket => buckets.has(bucket))
      .map(bucket => ({ bucket, label: DAY_BUCKET_LABELS[bucket], items: buckets.get(bucket)! }));
  });

  readonly filterCounts = computed<Record<NotificationFilter, number>>(() => {
    const counts: Record<NotificationFilter, number> = {
      all: 0, unread: 0, info: 0, success: 0, warning: 0, error: 0,
    };
    for (const n of this._notifications()) {
      counts.all++;
      if (!n.read) counts.unread++;
      counts[n.type]++;
    }
    return counts;
  });

  constructor() {
    effect(() => {
      this.storage.set(STORAGE_KEY, this._notifications());
    });
  }

  toggle(): void { this._isOpen.update(open => !open); }
  open(): void { this._isOpen.set(true); }
  close(): void { this._isOpen.set(false); }

  setFilter(filter: NotificationFilter): void {
    this._filter.set(filter);
  }

  add(notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>): void {
    const full = this.buildNotification(notification);
    this._notifications.update(list => this.capNotifications([full, ...list]));
    this.maybeShowToast(full);
  }

  addUserEvent(params: Omit<AppNotification, 'id' | 'timestamp' | 'read' | 'userId' | 'avatarUrl' | 'nickname'> & {
    userId: number;
    avatarUrl?: string | null;
    nickname?: string | null;
  }): void {
    const full = this.buildNotification(params);
    this._notifications.update(list => this.capNotifications([full, ...list]));
    this.maybeShowToast(full);
  }

  markAllRead(): void {
    this._notifications.update(list => list.map(n => ({ ...n, read: true })));
  }

  requestRemove(id: string): void {
    const notification = this._notifications().find(n => n.id === id);
    if (!notification) return;
    if (this.undoTimer) clearTimeout(this.undoTimer);
    this._undoEntry.set({ notification, expiresAt: Date.now() + UNDO_WINDOW_MS });
    this.undoTimer = setTimeout(() => {
      this.remove(notification.id);
      this._undoEntry.set(null);
      this.undoTimer = null;
    }, UNDO_WINDOW_MS);
  }

  undoRemove(): void {
    if (this.undoTimer) {
      clearTimeout(this.undoTimer);
      this.undoTimer = null;
    }
    this._undoEntry.set(null);
  }

  remove(id: string): void {
    this._notifications.update(list => list.filter(n => n.id !== id));
  }

  dismissToast(): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
    this._pendingToast.set(null);
  }

  clear(): void {
    if (this.undoTimer) { clearTimeout(this.undoTimer); this.undoTimer = null; }
    if (this.toastTimer) { clearTimeout(this.toastTimer); this.toastTimer = null; }
    this._undoEntry.set(null);
    this._pendingToast.set(null);
    this._notifications.set([]);
    this.storage.remove(STORAGE_KEY);
  }

  private buildNotification(
    params: Omit<AppNotification, 'id' | 'timestamp' | 'read'>,
  ): AppNotification {
    const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    return { ...params, id, timestamp: Date.now(), read: false };
  }

  private capNotifications(list: AppNotification[]): AppNotification[] {
    return list.length > MAX_NOTIFICATIONS ? list.slice(0, MAX_NOTIFICATIONS) : list;
  }

  private maybeShowToast(notification: AppNotification): void {
    if (this._isOpen()) return;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this._pendingToast.set(notification);
    this.toastTimer = setTimeout(() => this.dismissToast(), TOAST_PREVIEW_MS);
  }
}
```

- [ ] **Step 2: Verify — expected single, known compile error**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: exactly one error, `Property 'markRead' does not exist on type 'NotificationStore'`, at `notification-panel.component.ts`. If there are other errors, stop and investigate before continuing — Task 7 fixes this one.

- [ ] **Step 3: Commit**

```bash
git add src/app/store/notification.store.ts
git commit -m "$(cat <<'EOF'
feat(notifications): add filtering, day-grouping, undo, and toast preview to the store

NotificationStore now caps at 100 entries, exposes visibleItems/groupedItems
filtered and bucketed by day, and owns the undo-remove and toast-preview
timers itself (mirroring ToastService's self-arming setTimeout pattern).
Drops markRead(id), whose only caller is replaced by mark-read-on-open in
the next task.

Known: notification-panel.component.ts still calls the removed markRead()
and will not compile until it's rewritten in Task 7.
EOF
)"
```

---

## Task 3: `NotificationFilterTabsComponent`

**Files:**
- Create: `src/app/shared/ui/notification-panel/notification-filter-tabs.component.ts`

**Interfaces:**
- Consumes: `NotificationFilter` from `notification.model.ts` (Task 1).
- Produces: `NotificationFilterTabsComponent` with `active = input.required<NotificationFilter>()`, `counts = input.required<Record<NotificationFilter, number>>()`, `filterChange = output<NotificationFilter>()`. Consumed by Task 7.

- [ ] **Step 1: Write the implementation**

Create `src/app/shared/ui/notification-panel/notification-filter-tabs.component.ts`:

```ts
import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import type { NotificationFilter } from './notification.model';

interface TabDef {
  readonly value: NotificationFilter;
  readonly label: string;
}

const TABS: readonly TabDef[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'info', label: 'Info' },
  { value: 'success', label: 'Success' },
  { value: 'warning', label: 'Warning' },
  { value: 'error', label: 'Error' },
];

@Component({
  selector: 'app-notification-filter-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="filter-tabs" role="tablist" aria-label="Filter notifications">
      @for (tab of tabs; track tab.value) {
        <button
          type="button"
          role="tab"
          class="filter-tab"
          [class.active]="active() === tab.value"
          [attr.aria-selected]="active() === tab.value"
          (click)="filterChange.emit(tab.value)"
        >
          {{ tab.label }}
          @if (counts()[tab.value] > 0) {
            <span class="tab-count">{{ counts()[tab.value] }}</span>
          }
        </button>
      }
    </div>
  `,
  styles: [`
    .filter-tabs {
      display: flex;
      gap: var(--space-1);
      padding: var(--space-2) var(--space-4);
      overflow-x: auto;
      border-bottom: 1px solid var(--color-border);
      scrollbar-width: none;
    }
    .filter-tabs::-webkit-scrollbar { display: none; }

    .filter-tab {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 6px 10px;
      border-radius: var(--radius-full);
      border: none;
      background: transparent;
      color: var(--color-text-secondary);
      font-size: var(--text-xs);
      font-weight: var(--font-medium);
      cursor: pointer;
      transition: background-color 0.15s ease, color 0.15s ease;
    }
    .filter-tab:hover { background: var(--color-neutral-100); color: var(--color-text); }
    .filter-tab:focus-visible { outline: var(--focus-ring); outline-offset: 2px; }
    .filter-tab.active { background: var(--color-primary-500); color: var(--color-on-color); }
    :host-context(.dark) .filter-tab:hover { background: var(--color-neutral-700); }

    .tab-count { font-size: 10px; font-weight: var(--font-bold); opacity: 0.8; }
  `],
})
export class NotificationFilterTabsComponent {
  readonly active = input.required<NotificationFilter>();
  readonly counts = input.required<Record<NotificationFilter, number>>();
  readonly filterChange = output<NotificationFilter>();

  protected readonly tabs = TABS;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no new errors from this file (it isn't imported anywhere yet, so nothing new to break).

- [ ] **Step 3: Commit**

```bash
git add src/app/shared/ui/notification-panel/notification-filter-tabs.component.ts
git commit -m "feat(notifications): add NotificationFilterTabsComponent"
```

---

## Task 4: `NotificationItemComponent`

**Files:**
- Create: `src/app/shared/ui/notification-panel/notification-item.component.ts`

**Interfaces:**
- Consumes: `AppNotification` from `notification.model.ts` (Task 1); `relativeTime` from `@shared/utils/relative-time.util` (already exists); `AvatarComponent` from `@shared/ui/avatar/avatar.component` (already exists — `src`, `alt`, `initials`, `size`, `shape` inputs).
- Produces: `NotificationItemComponent` with `notification = input.required<AppNotification>()`, `remove = output<string>()` (emits the notification id — used by both the ✕ button and the swipe gesture), `open = output<AppNotification>()`. Consumed by Task 5.

- [ ] **Step 1: Write the implementation**

Create `src/app/shared/ui/notification-panel/notification-item.component.ts`:

```ts
import { Component, ChangeDetectionStrategy, input, output, signal } from '@angular/core';
import { LucideX } from '@lucide/angular';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { relativeTime } from '@shared/utils/relative-time.util';
import type { AppNotification } from './notification.model';

const SWIPE_THRESHOLD_PX = 72;
const SWIPE_SLOP_PX = 10;

@Component({
  selector: 'app-notification-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideX, AvatarComponent],
  template: `
    <article
      class="notification-item"
      [class.unread]="!notification().read"
      [attr.data-type]="notification().type"
      role="listitem"
      tabindex="0"
      [style.transform]="dragX() ? 'translateX(' + dragX() + 'px)' : null"
      [style.transition]="dragging() ? 'none' : null"
      (touchstart)="onTouchStart($event)"
      (touchmove)="onTouchMove($event)"
      (touchend)="onTouchEnd($event)"
      (click)="onOpen()"
      (keydown.enter)="onOpen()"
      (keydown.space)="onOpen(); $event.preventDefault()"
    >
      @if (notification().userId) {
        <app-avatar
          [src]="notification().avatarUrl ?? ''"
          [alt]="notification().nickname ?? 'User'"
          [initials]="notification().nickname ? notification().nickname!.slice(0, 2) : null"
          size="sm"
          shape="circle"
          class="notification-avatar"
        />
      } @else {
        <div class="notification-indicator" [attr.data-type]="notification().type" aria-hidden="true"></div>
      }
      <div class="notification-content">
        <p class="notification-title">{{ notification().title }}</p>
        @if (notification().message) {
          <p class="notification-message">{{ notification().message }}</p>
        }
        <time class="notification-time" [attr.datetime]="isoTimestamp(notification().timestamp)">
          {{ relativeTime(notification().timestamp) }}
        </time>
      </div>
      <button
        type="button"
        class="remove-btn"
        (click)="onRemoveClick($event)"
        [attr.aria-label]="'Remove notification: ' + notification().title"
      >
        <svg aria-hidden="true" lucideX [size]="12" class="remove-icon"></svg>
      </button>
    </article>
  `,
  styles: [`
    .notification-item {
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
      padding: var(--space-3);
      border-radius: var(--radius-lg);
      cursor: pointer;
      transition: background-color 0.15s ease;
      position: relative;
      touch-action: pan-y;
    }
    .notification-item:hover { background: var(--color-neutral-50); }
    .notification-item:focus-visible { outline: var(--focus-ring); outline-offset: -2px; }
    .notification-item.unread { background: color-mix(in srgb, var(--color-primary-500) 6%, transparent); }
    .notification-item.unread:hover { background: color-mix(in srgb, var(--color-primary-500) 10%, transparent); }
    :host-context(.dark) .notification-item:hover { background: var(--color-neutral-800); }
    :host-context(.dark) .notification-item.unread { background: color-mix(in srgb, var(--color-primary-500) 12%, transparent); }
    :host-context(.dark) .notification-item.unread:hover { background: color-mix(in srgb, var(--color-primary-500) 18%, transparent); }

    .notification-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
      margin-top: 6px;
    }
    .notification-indicator[data-type="info"] { background: var(--color-primary-500); }
    .notification-indicator[data-type="success"] { background: var(--color-accent-500); }
    .notification-indicator[data-type="warning"] { background: var(--color-gold-500); }
    .notification-indicator[data-type="error"] { background: var(--color-warm-500); }

    .notification-content { flex: 1; min-width: 0; }
    .notification-title { font-size: var(--text-sm); font-weight: var(--font-medium); color: var(--color-text); margin: 0; line-height: 1.4; }
    .notification-item.unread .notification-title { font-weight: var(--font-semibold); }
    .notification-message { font-size: var(--text-xs); color: var(--color-text-secondary); margin: 2px 0 0; line-height: 1.5; }
    .notification-time { display: block; font-size: 11px; color: var(--color-text-tertiary); margin-top: 4px; }
    .notification-avatar { flex-shrink: 0; align-self: flex-start; margin-top: 2px; }

    .remove-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: var(--radius-md);
      background: transparent;
      border: none;
      cursor: pointer;
      color: var(--color-text-tertiary);
      opacity: 0;
      transition: opacity 0.15s ease, background-color 0.15s ease, color 0.15s ease;
      flex-shrink: 0;
    }
    .notification-item:hover .remove-btn { opacity: 1; }
    .remove-btn:hover { background: var(--color-neutral-200); color: var(--color-text-secondary); }
    :host-context(.dark) .remove-btn:hover { background: var(--color-neutral-600); }
  `],
})
export class NotificationItemComponent {
  readonly notification = input.required<AppNotification>();
  readonly remove = output<string>();
  readonly open = output<AppNotification>();

  readonly relativeTime = relativeTime;
  readonly dragX = signal(0);
  readonly dragging = signal(false);

  private touchStartX = 0;
  private touchStartY = 0;
  private didSwipe = false;

  isoTimestamp(ts: number): string {
    return new Date(ts).toISOString();
  }

  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.touches[0]!.clientX;
    this.touchStartY = event.touches[0]!.clientY;
    this.didSwipe = false;
    this.dragging.set(true);
  }

  onTouchMove(event: TouchEvent): void {
    if (!this.dragging()) return;
    const deltaX = event.touches[0]!.clientX - this.touchStartX;
    const deltaY = event.touches[0]!.clientY - this.touchStartY;
    if (Math.abs(deltaY) > Math.abs(deltaX)) return;
    if (Math.abs(deltaX) > SWIPE_SLOP_PX) this.didSwipe = true;
    if (deltaX < 0) this.dragX.set(deltaX);
  }

  onTouchEnd(event: TouchEvent): void {
    if (!this.dragging()) return;
    this.dragging.set(false);
    const deltaX = event.changedTouches[0]!.clientX - this.touchStartX;
    if (deltaX < -SWIPE_THRESHOLD_PX) {
      this.remove.emit(this.notification().id);
    } else {
      this.dragX.set(0);
    }
  }

  onOpen(): void {
    if (this.didSwipe) {
      this.didSwipe = false;
      return;
    }
    this.open.emit(this.notification());
  }

  onRemoveClick(event: MouseEvent): void {
    event.stopPropagation();
    this.remove.emit(this.notification().id);
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no new errors from this file.

- [ ] **Step 3: Commit**

```bash
git add src/app/shared/ui/notification-panel/notification-item.component.ts
git commit -m "feat(notifications): add NotificationItemComponent with swipe-to-dismiss"
```

---

## Task 5: `NotificationDayGroupComponent`

**Files:**
- Create: `src/app/shared/ui/notification-panel/notification-day-group.component.ts`

**Interfaces:**
- Consumes: `NotificationItemComponent` (Task 4), `AppNotification` from `notification.model.ts` (Task 1).
- Produces: `NotificationDayGroupComponent` with `label = input.required<string>()`, `items = input.required<readonly AppNotification[]>()`, `remove = output<string>()`, `open = output<AppNotification>()` (both re-emitted from the child item). Consumed by Task 7.

- [ ] **Step 1: Write the implementation**

Create `src/app/shared/ui/notification-panel/notification-day-group.component.ts`:

```ts
import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { NotificationItemComponent } from './notification-item.component';
import type { AppNotification } from './notification.model';

@Component({
  selector: 'app-notification-day-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NotificationItemComponent],
  template: `
    <section class="day-group" [attr.aria-label]="label()">
      <h3 class="day-group-label">{{ label() }}</h3>
      @for (item of items(); track item.id) {
        <app-notification-item
          [notification]="item"
          (remove)="remove.emit($event)"
          (open)="open.emit($event)"
        />
      }
    </section>
  `,
  styles: [`
    .day-group-label {
      margin: var(--space-2) var(--space-1) 4px;
      font-size: 11px;
      font-weight: var(--font-semibold);
      text-transform: uppercase;
      letter-spacing: var(--letter-spacing-wide);
      color: var(--color-text-tertiary);
    }
  `],
})
export class NotificationDayGroupComponent {
  readonly label = input.required<string>();
  readonly items = input.required<readonly AppNotification[]>();
  readonly remove = output<string>();
  readonly open = output<AppNotification>();
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no new errors from this file.

- [ ] **Step 3: Commit**

```bash
git add src/app/shared/ui/notification-panel/notification-day-group.component.ts
git commit -m "feat(notifications): add NotificationDayGroupComponent"
```

---

## Task 6: `NotificationToastComponent`

**Files:**
- Create: `src/app/shared/ui/notification-panel/notification-toast.component.ts`

**Interfaces:**
- Consumes: `NotificationStore.pendingToast`/`dismissToast()` (Task 2).
- Produces: `NotificationToastComponent`, mounted once at app-root level in Task 8.

- [ ] **Step 1: Write the implementation**

Create `src/app/shared/ui/notification-panel/notification-toast.component.ts`:

```ts
import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { NotificationStore } from '@store/notification.store';
import { LucideCheckCircle, LucideAlertCircle, LucideAlertTriangle, LucideInfo } from '@lucide/angular';

@Component({
  selector: 'app-notification-toast',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideCheckCircle, LucideAlertCircle, LucideAlertTriangle, LucideInfo],
  template: `
    @if (store.pendingToast(); as n) {
      <button
        type="button"
        class="notification-toast"
        [class]="'toast-' + n.type"
        (click)="store.dismissToast()"
        aria-live="polite"
      >
        <span class="toast-icon" aria-hidden="true">
          @switch (n.type) {
            @case ('success') { <svg lucideCheckCircle [size]="16"></svg> }
            @case ('error') { <svg lucideAlertCircle [size]="16"></svg> }
            @case ('warning') { <svg lucideAlertTriangle [size]="16"></svg> }
            @default { <svg lucideInfo [size]="16"></svg> }
          }
        </span>
        <span class="toast-text">
          <span class="toast-title">{{ n.title }}</span>
          @if (n.message) {
            <span class="toast-message">{{ n.message }}</span>
          }
        </span>
      </button>
    }
  `,
  styles: [`
    .notification-toast {
      position: fixed;
      top: calc(var(--app-header-height) + var(--space-3));
      right: var(--space-4);
      z-index: var(--z-toast);
      display: flex;
      align-items: flex-start;
      gap: var(--space-2);
      max-width: 320px;
      padding: var(--space-3);
      border-radius: var(--radius-lg);
      background: var(--color-card);
      border: 1px solid var(--color-border);
      box-shadow: var(--shadow-xl);
      cursor: pointer;
      text-align: left;
      animation: toast-preview-enter 0.2s ease-out;
    }
    @keyframes toast-preview-enter {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .toast-icon { flex-shrink: 0; margin-top: 1px; }
    .toast-info .toast-icon { color: var(--color-primary-500); }
    .toast-success .toast-icon { color: var(--color-accent-500); }
    .toast-warning .toast-icon { color: var(--color-gold-500); }
    .toast-error .toast-icon { color: var(--color-warm-500); }
    .toast-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .toast-title { font-size: var(--text-sm); font-weight: var(--font-medium); color: var(--color-text); }
    .toast-message { font-size: var(--text-xs); color: var(--color-text-secondary); }
  `],
})
export class NotificationToastComponent {
  protected readonly store = inject(NotificationStore);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no new errors from this file.

- [ ] **Step 3: Commit**

```bash
git add src/app/shared/ui/notification-panel/notification-toast.component.ts
git commit -m "feat(notifications): add NotificationToastComponent for live-arrival previews"
```

---

## Task 7: Rewrite `NotificationPanelComponent` (shell)

**Files:**
- Modify: `src/app/shared/ui/notification-panel/notification-panel.component.ts` (full rewrite)

**Interfaces:**
- Consumes: `NotificationFilterTabsComponent` (Task 3), `NotificationDayGroupComponent` (Task 5), `NotificationStore` (Task 2), `UserInfoModalComponent`/`UserInfoModalData` (existing, unchanged), `UserInfoService` (existing, unchanged).
- Produces: `NotificationPanelComponent` (same selector `app-notification-panel`, same public shape from the outside — `header.component.ts` needs no changes).

- [ ] **Step 1: Rewrite the component**

Replace the full contents of `src/app/shared/ui/notification-panel/notification-panel.component.ts` with:

```ts
import { Component, ChangeDetectionStrategy, DestroyRef, ElementRef, PLATFORM_ID, computed, effect, inject, signal, viewChild } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Dialog } from '@angular/cdk/dialog';
import { LucideBell, LucideCheck, LucideTrash2 } from '@lucide/angular';
import { NotificationStore } from '@store/notification.store';
import { UserInfoService } from '@core/services/user-info.service';
import { UserInfoModalComponent, UserInfoModalData } from '@shared/ui/user-info-modal';
import { NotificationFilterTabsComponent } from './notification-filter-tabs.component';
import { NotificationDayGroupComponent } from './notification-day-group.component';
import type { AppNotification } from './notification.model';

const SHEET_CLOSE_THRESHOLD_PX = 80;
const MOBILE_BREAKPOINT_QUERY = '(max-width: 768px)';

@Component({
  selector: 'app-notification-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'store.close()',
  },
  imports: [LucideBell, LucideCheck, LucideTrash2, NotificationFilterTabsComponent, NotificationDayGroupComponent],
  template: `
    @if (store.isOpen()) {
      <div class="notification-overlay" (click)="onOverlayClick()" role="presentation"></div>
      <div
        #panelRoot
        class="notification-panel"
        [class.sheet]="isMobile()"
        role="dialog"
        aria-modal="true"
        aria-label="Notifications"
        aria-describedby="notification-list"
        tabindex="-1"
        [style.transform]="dragY() ? 'translateY(' + dragY() + 'px)' : null"
        [style.transition]="dragging() ? 'none' : null"
        (touchstart)="onSheetTouchStart($event)"
        (touchmove)="onSheetTouchMove($event)"
        (touchend)="onSheetTouchEnd($event)"
      >
        @if (isMobile()) {
          <div class="sheet-handle" aria-hidden="true"></div>
        }
        <header class="panel-header">
          <div class="header-title">
            <svg aria-hidden="true" lucideBell [size]="16" class="header-icon"></svg>
            <span class="header-text">Notifications</span>
            @if (store.unreadCount() > 0) {
              <span class="unread-badge" aria-label="{{ store.unreadCount() }} unread">
                {{ store.unreadCount() }}
              </span>
            }
          </div>
          <div class="header-actions">
            @if (store.unreadCount() > 0) {
              <button type="button" class="action-btn" (click)="store.markAllRead()" aria-label="Mark all notifications as read">
                <svg aria-hidden="true" lucideCheck [size]="14" class="action-icon"></svg>
                <span class="action-text">Mark all read</span>
              </button>
            }
            @if (store.hasNotifications()) {
              <button type="button" class="action-btn danger" (click)="store.clear()" aria-label="Clear all notifications">
                <svg aria-hidden="true" lucideTrash2 [size]="14" class="action-icon"></svg>
                <span class="action-text">Clear all</span>
              </button>
            }
          </div>
        </header>

        <app-notification-filter-tabs
          [active]="store.filter()"
          [counts]="store.filterCounts()"
          (filterChange)="store.setFilter($event)"
        />

        <main id="notification-list" class="panel-content" role="list" aria-label="Notification list" aria-live="polite" aria-atomic="false">
          @if (store.groupedItems().length === 0) {
            <div class="empty-state" role="status">
              <svg aria-hidden="true" lucideBell [size]="32" class="empty-icon"></svg>
              <p class="empty-title">{{ emptyTitle() }}</p>
              <p class="empty-description">We'll notify you when something happens</p>
            </div>
          } @else {
            @for (group of store.groupedItems(); track group.bucket) {
              <app-notification-day-group
                [label]="group.label"
                [items]="group.items"
                (remove)="onItemRemove($event)"
                (open)="onItemOpen($event)"
              />
            }
          }
        </main>
      </div>
    }
  `,
  styles: [`
    .notification-overlay { position: fixed; inset: 0; z-index: 39; background: transparent; }

    .notification-panel {
      position: fixed;
      top: 60px;
      right: var(--space-4);
      z-index: 40;
      width: 380px;
      max-height: 520px;
      background: var(--color-card);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-elevation-3);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: slideIn 0.2s ease-out;
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .notification-panel.sheet {
      top: auto;
      bottom: 0;
      left: 0;
      right: 0;
      width: 100%;
      max-height: 70dvh;
      border-radius: var(--radius-2xl) var(--radius-2xl) 0 0;
      padding-bottom: env(safe-area-inset-bottom);
      animation: sheetIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
      touch-action: pan-y;
    }
    @keyframes sheetIn {
      from { opacity: 0; transform: translateY(24px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .sheet-handle {
      width: 40px;
      height: 4px;
      border-radius: 2px;
      background: var(--color-neutral-300);
      margin: var(--space-2) auto 0;
      flex-shrink: 0;
    }
    :host-context(.dark) .sheet-handle { background: var(--color-neutral-600); }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-3) var(--space-4);
      border-bottom: 1px solid var(--color-border);
      gap: var(--space-2);
    }
    .header-title { display: flex; align-items: center; gap: var(--space-2); }
    .header-icon { color: var(--color-text-secondary); }
    .header-text { font-size: var(--text-sm); font-weight: var(--font-semibold); color: var(--color-text); }
    .unread-badge {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 20px; height: 20px; padding: 0 6px;
      border-radius: var(--radius-full); background: var(--color-warm-500); color: var(--color-on-color);
      font-size: 11px; font-weight: var(--font-bold); line-height: 1;
    }
    .header-actions { display: flex; align-items: center; gap: var(--space-1); }
    .action-btn {
      display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px;
      border-radius: var(--radius-md); font-size: var(--text-xs); font-weight: var(--font-medium);
      color: var(--color-text-secondary); background: transparent; border: none; cursor: pointer;
      transition: background-color 0.15s ease, color 0.15s ease;
    }
    .action-btn:hover { background: var(--color-neutral-100); color: var(--color-text); }
    .action-btn:focus-visible { outline: var(--focus-ring); outline-offset: 2px; }
    .action-btn.danger:hover { background: color-mix(in srgb, var(--color-warm-500) 10%, transparent); color: var(--color-warm-600); }
    :host-context(.dark) .action-btn:hover { background: var(--color-neutral-700); }
    :host-context(.dark) .action-btn.danger:hover { background: color-mix(in srgb, var(--color-warm-500) 15%, transparent); color: var(--color-warm-400); }
    .action-icon { flex-shrink: 0; }

    .panel-content { flex: 1; overflow-y: auto; overflow-x: hidden; padding: var(--space-2); }
    .panel-content::-webkit-scrollbar { width: 6px; }
    .panel-content::-webkit-scrollbar-track { background: transparent; }
    .panel-content::-webkit-scrollbar-thumb { background: var(--color-neutral-300); border-radius: 3px; }
    :host-context(.dark) .panel-content::-webkit-scrollbar-thumb { background: var(--color-neutral-600); }

    .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--space-10) var(--space-4); text-align: center; }
    .empty-icon { color: var(--color-text-tertiary); opacity: 0.5; margin-bottom: var(--space-3); }
    .empty-title { font-size: var(--text-sm); font-weight: var(--font-medium); color: var(--color-text-secondary); margin: 0 0 var(--space-1); }
    .empty-description { font-size: var(--text-xs); color: var(--color-text-tertiary); margin: 0; }
  `],
})
export class NotificationPanelComponent {
  readonly store = inject(NotificationStore);
  private readonly dialog = inject(Dialog);
  private readonly userInfo = inject(UserInfoService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _isMobile = signal(false);
  readonly isMobile = this._isMobile.asReadonly();

  readonly dragY = signal(0);
  readonly dragging = signal(false);
  private sheetTouchStartY = 0;

  private previouslyFocused: HTMLElement | null = null;
  private readonly panelRootRef = viewChild<ElementRef<HTMLElement>>('panelRoot');

  readonly emptyTitle = computed(() => {
    const filter = this.store.filter();
    if (filter === 'all') return 'No notifications yet';
    if (filter === 'unread') return 'No unread notifications';
    return `No ${filter} notifications`;
  });

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const mql = window.matchMedia(MOBILE_BREAKPOINT_QUERY);
      const apply = () => this._isMobile.set(mql.matches);
      apply();
      mql.addEventListener('change', apply);
      this.destroyRef.onDestroy(() => mql.removeEventListener('change', apply));
    }

    effect(() => {
      if (this.store.isOpen()) {
        this.store.markAllRead();
        this.previouslyFocused = document.activeElement as HTMLElement | null;
        queueMicrotask(() => this.panelRootRef()?.nativeElement.focus());
      } else if (this.previouslyFocused) {
        this.previouslyFocused.focus();
        this.previouslyFocused = null;
      }
    });
  }

  onOverlayClick(): void {
    this.store.close();
  }

  onItemOpen(notification: AppNotification): void {
    if (!notification.userId) return;
    void this.userInfo.fetchUserInfo(notification.userId);
    this.dialog.open<UserInfoModalComponent, UserInfoModalData>(UserInfoModalComponent, {
      data: {
        userId: notification.userId,
        nickname: notification.nickname ?? null,
        headUrl: notification.avatarUrl ?? null,
      },
      backdropClass: 'app-modal-backdrop',
      ariaLabelledBy: 'user-info-title',
    });
  }

  onItemRemove(id: string): void {
    this.store.requestRemove(id);
  }

  onSheetTouchStart(event: TouchEvent): void {
    if (!this.isMobile()) return;
    this.sheetTouchStartY = event.touches[0]!.clientY;
    this.dragging.set(true);
  }

  onSheetTouchMove(event: TouchEvent): void {
    if (!this.dragging()) return;
    const delta = event.touches[0]!.clientY - this.sheetTouchStartY;
    if (delta > 0) this.dragY.set(delta);
  }

  onSheetTouchEnd(event: TouchEvent): void {
    if (!this.dragging()) return;
    this.dragging.set(false);
    const delta = event.changedTouches[0]!.clientY - this.sheetTouchStartY;
    this.dragY.set(0);
    if (delta > SHEET_CLOSE_THRESHOLD_PX) this.store.close();
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: 0 errors — this resolves the `markRead` error flagged in Task 2.

- [ ] **Step 3: Commit**

```bash
git add src/app/shared/ui/notification-panel/notification-panel.component.ts
git commit -m "$(cat <<'EOF'
refactor(notifications): rewrite NotificationPanelComponent as a thin shell

Composes the new filter-tabs and day-group components, adds a mobile
bottom-sheet layout (matching the existing room-header overflow-menu
pattern: matchMedia breakpoint detection, touch-based swipe-to-close,
manual focus management) and mark-read-on-open. Item removal now always
routes through the undoable store.requestRemove().
EOF
)"
```

---

## Task 8: Wire in `NotificationToastComponent`, update `index.ts`

**Files:**
- Modify: `src/app/shared/ui/notification-panel/index.ts`
- Modify: `src/app/app.ts`

**Interfaces:**
- Consumes: `NotificationToastComponent` (Task 6).

- [ ] **Step 1: Update the public export surface**

Replace the contents of `src/app/shared/ui/notification-panel/index.ts` with:

```ts
export { NotificationPanelComponent } from './notification-panel.component';
export { NotificationToastComponent } from './notification-toast.component';
export type {
  AppNotification,
  NotificationType,
  NotificationFilter,
  NotificationGroup,
  UndoEntry,
} from './notification.model';
```

- [ ] **Step 2: Mount the toast component in the app shell**

In `src/app/app.ts`, add the import alongside the other `@shared/ui` import:

```ts
import { PwaUpdateBannerComponent } from '@shared/ui';
```
becomes two lines:
```ts
import { PwaUpdateBannerComponent } from '@shared/ui';
import { NotificationToastComponent } from '@shared/ui/notification-panel';
```

Add `NotificationToastComponent` to the `imports:` array in the `@Component` decorator:

```ts
imports: [RouterOutlet, SidenavComponent, HeaderComponent, ToastContainerComponent, PwaUpdateBannerComponent, MinimizedRoomBarComponent],
```
becomes:
```ts
imports: [RouterOutlet, SidenavComponent, HeaderComponent, ToastContainerComponent, PwaUpdateBannerComponent, MinimizedRoomBarComponent, NotificationToastComponent],
```

Add `<app-notification-toast />` to the template, right after `<app-toast-container />`:

```html
    <app-toast-container />
    <app-notification-toast />
```

- [ ] **Step 3: Verify the app still builds**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/shared/ui/notification-panel/index.ts src/app/app.ts
git commit -m "feat(notifications): mount NotificationToastComponent at the app shell"
```

---

## Task 9: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Type-check the whole app**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: 0 errors.

- [ ] **Step 2: Run the existing test suite as a regression check**

Run: `npx ng test --watch=false`
Expected: every pre-existing test file still passes (no new spec files exist for this feature, per the user's "skip unit tests" instruction — this step only confirms nothing else broke).

- [ ] **Step 3: Production build**

Run: `npx ng build --configuration development`
Expected: build succeeds (Sass `@import` deprecation warnings are pre-existing and expected; no new errors).

- [ ] **Step 4: Manual verification in the browser**

Use the `/run` skill (or `ng serve` + Chrome) to drive the actual flow:
- Trigger a few notifications of different types (e.g. via the existing dev flows that call `notificationStore.add()`/`addUserEvent()`), confirm they group under "Today", filter tabs show correct counts, switching filters doesn't lose the unread badge behavior.
- Confirm opening the bell marks everything read (badge clears) regardless of which filter was last active.
- On a touch-emulated mobile viewport (Chrome DevTools device toolbar), confirm the panel renders as a bottom sheet, drag-down-to-close works past 80px, and swiping a notification item left past 72px removes it with the item visibly translating before removal.
- Confirm the hover ✕ button on desktop also removes an item (routes through the same undo path).
- Trigger a notification while the panel is closed and confirm the preview toast appears top-right, auto-dismisses after ~4s, and does not appear if the panel is already open when the notification arrives.

- [ ] **Step 5: Report results**

If any step fails, stop and fix before considering the plan complete — do not report success without every command's actual output confirming it.

---

## Self-Review Notes (completed during plan-writing)

**Spec coverage:** All 8 goals from the design spec section 1 map to tasks — day-grouping/relative-time (Tasks 1-2, reusing existing `relativeTime` util per the noted deviation), mobile bottom sheet + swipe (Task 7), type filters (Task 3), live-arrival toast (Task 6, 8), mark-read-on-open (Task 7), bounded storage (Task 2). The §7 RTL open question from the spec is not actioned in this plan (no RTL infrastructure exists in the codebase to hook into) — flagged to the user before implementation begins.

**Placeholder scan:** No TBD/TODO markers; every step has complete, runnable code.

**Type consistency:** `remove = output<string>()` (the notification id) is used identically in `NotificationItemComponent` (Task 4), re-emitted by `NotificationDayGroupComponent` (Task 5), and consumed as `onItemRemove(id: string)` in the panel (Task 7) — consistent throughout. `open = output<AppNotification>()` follows the same chain. `NotificationFilter`/`NotificationGroup`/`UndoEntry`/`AppNotification` are defined once in Task 1 and imported everywhere else, never redeclared.

**Test-skip note:** Per user instruction, no `.spec.ts` files are authored in this plan. This means the store's cap-at-100, undo-timer, toast-timer, and day-bucketing logic — all timer- and clock-dependent — have no automated regression coverage after this work lands. Task 9 Step 4's manual browser pass is the only verification for that logic; flagging this explicitly so it's a visible trade-off, not a silent gap.
