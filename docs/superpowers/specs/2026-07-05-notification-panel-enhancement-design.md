# Notification Panel Enhancement

**Date:** 2026-07-05
**Scope:** `shared/ui/notification-panel/**` (consumer/presentation layer) and `store/notification.store.ts` (state). Producer-side delivery/dedup (which events fire a toast vs. a notification) was already handled by `2026-07-01-notification-ux-design.md` and is out of scope here — this spec is about how the panel looks, scans, and behaves once a notification exists in the store.

## 1. Goals

1. **Look & feel** — calm, content-first; subtle motion; the bell badge and unread row tinting remain the main attention cues. Fix current cramping at narrow widths (380px fixed width, header actions overflow).
2. **Scannable list** — group by day (Today / Yesterday / This week / Earlier); relative time ("5 min ago") instead of absolute timestamps.
3. **Mobile-first layout** — bottom sheet on ≤768px (full-width, ~70% viewport height, drag handle, swipe-down or backdrop-tap to dismiss). Desktop keeps the right-anchored dropdown.
4. **Touch gesture** — swipe an item (leftward, see §7 for the RTL caveat) to reveal a delete affordance; past a ~72px threshold, removes the item with an undo toast (8s window). The existing hover-visible remove (✕) button is kept for non-touch input and goes through the same undo path (§5).
5. **Type filtering** — tab strip: All / Unread / Info / Success / Warning / Error, each showing a count.
6. **Live arrivals** — a small, non-blocking preview toast (4s, dismissible) shows when a notification is added while the panel is closed. The full record still lands in the panel; no toast when the panel is already open (the item just appears in the list).
7. **Read semantics** — opening the panel marks every notification as read (mark-read-on-open, same effect as the existing "Mark all read" button — not scoped to the active filter, so switching filters never leaves stale unread badges). Clicking an item opens its action (user-linked → profile modal) without being a separate "mark read" gesture.
8. **Bounded storage** — cap at 100 notifications; `add()`/`addUserEvent()` drop the oldest past the cap.

## 2. Non-goals

- No new notification types or producers — only how `NotificationStore`'s existing consumers (panel, toast) present and filter what's already being added.
- No real-time transport work (websocket/polling/SSE). The toast fires whenever `add()`/`addUserEvent()` is called by existing callers; those call sites are untouched.
- No new i18n framework. Relative time uses `Intl.RelativeTimeFormat('en')`; if the project adopts real i18n later, this pipe is the seam to swap.
- No virtualized scrolling. Cap of 100 keeps the DOM small enough that virtualization isn't justified; revisit if the cap changes.

## 3. Architecture & file layout

```
src/app/
├── shared/
│   ├── pipes/
│   │   └── relative-time.pipe.ts                  NEW — pure pipe, Intl.RelativeTimeFormat
│   └── ui/
│       └── notification-panel/
│           ├── notification.model.ts              NEW — AppNotification, NotificationType
│           │                                          (moved out of the store; see §3.1)
│           ├── notification-panel.component.ts    CHANGED — shell: filters + grouped list,
│           │                                          CDK focus trap, escape-to-close,
│           │                                          bottom-sheet layout via BreakpointObserver
│           ├── notification-filter-tabs.component.ts   NEW — dumb tab strip
│           ├── notification-day-group.component.ts     NEW — dumb day-bucket header + item list
│           ├── notification-item.component.ts          NEW — dumb; owns its own swipe gesture
│           ├── notification-toast.component.ts         NEW — viewport-fixed preview toast
│           └── index.ts                           CHANGED — re-export new public pieces
│
├── store/
│   └── notification.store.ts                      CHANGED — filter, grouping, undo buffer,
│                                                       pendingToast, cap=100, re-exports
│                                                       AppNotification/NotificationType from
│                                                       the new model file for callers that
│                                                       still import from the store
```

### 3.1 Why `notification.model.ts` moves out of the store

`NotificationItemComponent` and its siblings are dumb, generic-shaped components. Per CLAUDE.md §2, `shared/ui/` may not import `store/` (dependencies point downward: `features → store → core → shared`). Today `notification-panel.component.ts` imports `AppNotification` from `@store/notification.store`, which already violates that direction — it works today only because nothing enforces the type-only import boundary as strictly as value imports, but it's still backwards. Moving the interface to a file co-located with its primary consumer (`shared/ui/notification-panel/notification.model.ts`) fixes the direction; `store/notification.store.ts` imports and re-exports it so existing call sites (`app.config.ts`, anywhere calling `notificationStore.add(...)`) don't need to change their import path.

### 3.2 Why no separate `NotificationListComponent`

An earlier draft of this design had a `NotificationListComponent` wrapping the day-groups purely to own the swipe gesture. Since each `NotificationItemComponent` already owns its own DOM node and can hold its own local drag-offset signal, the wrapper added no behavior of its own — just an `@for` pass-through. Dropped per YAGNI; `notification-panel.component.ts` renders `@for` over `store.groupedItems()` directly into `<app-notification-day-group>`.

## 4. Store contract

```ts
// store/notification.store.ts

export type NotificationFilter = 'all' | 'unread' | NotificationType;
export type DayBucket = 'today' | 'yesterday' | 'this-week' | 'earlier';

export interface NotificationGroup {
  readonly label: string;   // "Today", "Yesterday", "This week", "Earlier"
  readonly bucket: DayBucket;
  readonly items: readonly AppNotification[];
}

export interface UndoEntry {
  readonly notification: AppNotification;
  readonly expiresAt: number; // ms epoch; UI computes remaining time for display if needed
}

@Injectable({ providedIn: 'root' })
export class NotificationStore {
  // existing, unchanged
  readonly notifications: Signal<readonly AppNotification[]>;
  readonly isOpen: Signal<boolean>;
  readonly unreadCount: Signal<number>;
  readonly hasNotifications: Signal<boolean>;
  toggle(): void;
  open(): void;
  close(): void;
  add(notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>): void;      // now caps at 100
  addUserEvent(params: /* unchanged shape */): void;                                 // now caps at 100
  markRead(id: string): void;      // kept for any direct callers; panel no longer calls this per-item
  markAllRead(): void;             // kept, unchanged; also what mark-read-on-open calls (§7)
  remove(id: string): void;        // kept as the immediate/no-undo remove; used internally by
                                     // requestRemove's timer-expiry commit, not called directly by the UI
  clear(): void;

  // new
  readonly filter: Signal<NotificationFilter>;
  readonly visibleItems: Signal<readonly AppNotification[]>;         // filtered + time-ordered
  readonly groupedItems: Signal<readonly NotificationGroup[]>;       // visibleItems bucketed by day
  readonly filterCounts: Signal<Readonly<Record<NotificationFilter, number>>>;
  readonly pendingToast: Signal<AppNotification | null>;
  readonly undoEntry: Signal<UndoEntry | null>;

  setFilter(filter: NotificationFilter): void;
  requestRemove(id: string): void; // soft-remove: moves item to undoEntry, arms an 8s commit timer.
                                     // This is the ONLY remove path the UI calls — both the swipe
                                     // gesture and the existing hover ✕ button route through it, so
                                     // every user-initiated removal gets the same undo affordance.
  undoRemove(): void;              // restores the item from undoEntry, clears the timer
  dismissToast(): void;            // clears pendingToast (called by the toast component on timeout/click)
}
```

**Invariants**
- `notifications()` is ground truth, capped at 100 (oldest dropped) inside `add()`/`addUserEvent()`.
- `visibleItems()` = `notifications()` filtered by `filter()`, already newest-first (insertion order is already newest-first today).
- `groupedItems()` is a `computed()` over `visibleItems()`, bucketed by local calendar day against `Date.now()` at read time. (Computed signals re-evaluate on read within the same tick if a dependency changed; the "today rolls over at midnight" edge case is accepted as a known, harmless staleness — same as any signal-based clock.)
- `requestRemove(id)` does not remove from `notifications()` immediately: it filters the item out of the *rendered* view by having `visibleItems()` also exclude whatever's currently in `undoEntry()`, and starts an 8s timer. `undoRemove()` clears the timer and clears `undoEntry()` (item reappears since it's still in `notifications()`). Timer expiry calls the existing `remove(id)` and clears `undoEntry()`.
- `pendingToast()` is set inside `add()`/`addUserEvent()` only when `isOpen()` is `false` at call time. `dismissToast()` (called by the toast component's own 4s timer or a user click) sets it back to `null`.
- `markAllRead()` (existing, unchanged) is called by the panel component via an `effect()` on `isOpen()`'s `false → true` transition — not by the store itself, since "on open" is a UI-layer concept the store shouldn't need to know about via its own internal effect (keeps the store decoupled from when/why it's opened). This reuses the exact method the header's "Mark all read" button already calls; no new store method needed for read-on-open.

## 5. Components & interaction details

All new components: `ChangeDetectionStrategy.OnPush`, signal `input()`/`output()`, `inject()`, native `@if`/`@for`, no manual `subscribe()` (per CLAUDE.md §8-10).

**`NotificationPanelComponent`** (shell)
- Injects `NotificationStore`, `Dialog`, `UserInfoService`, `BreakpointObserver` (`@angular/cdk/layout`, already a project dependency via other CDK usage).
- `isMobile = toSignal(breakpointObserver.observe('(max-width: 768px)').pipe(map(r => r.matches)), { initialValue: false })`.
- `constructor` `effect()`: on `store.isOpen()` transitioning `false → true`, call `store.markAllRead()`. Guarded with a local `previousOpen` signal read inside the effect (untracked) to detect the transition edge, not just the level.
- Adds `cdkTrapFocus` + `cdkTrapFocusAutoCapture` to the panel root when open; `(keydown.escape)="store.close()"`.
- Template: header (title, unread badge, mark-all-read/clear actions — unchanged) → `<app-notification-filter-tabs>` → `@for (group of store.groupedItems(); track group.bucket) { <app-notification-day-group> }` → empty state (reworded per active filter).
- `[class.sheet]="isMobile()"` toggles the CSS layout between dropdown and bottom sheet; backdrop tap and swipe-down both call `store.close()`.
- `openUserModal(...)` stays exactly as it is today (unchanged) — it's a smart-layer concern (owns the `Dialog` injection), triggered by the item's `open` output.

**`NotificationFilterTabsComponent`** (dumb)
- `active = input.required<NotificationFilter>()`, `counts = input.required<Readonly<Record<NotificationFilter, number>>>()`, `filterChange = output<NotificationFilter>()`.
- `role="tablist"` of 6 `role="tab"` buttons with `[attr.aria-selected]`.

**`NotificationDayGroupComponent`** (dumb)
- `label = input.required<string>()`, `items = input.required<readonly AppNotification[]>()`, `remove = output<string>()`, `open = output<AppNotification>()`.
- Renders a small header (`label`) then `@for (item of items(); track item.id)` → `<app-notification-item>`, re-emitting its outputs.

**`NotificationItemComponent`** (dumb, owns its own swipe gesture)
- `notification = input.required<AppNotification>()`, `remove = output<string>()`, `open = output<AppNotification>()`.
- Local `dragX = signal(0)`, bound via `[style.transform]="'translateX(' + dragX() + 'px)'"`.
- `(pointerdown)/(pointermove)/(pointerup)/(pointercancel)` on the root `<article>`. On `pointermove`, only capture the gesture once `abs(deltaX) > abs(deltaY)` (so vertical scroll / the mobile sheet's own vertical drag isn't hijacked); until that decision, don't call `preventDefault()`.
- Past a 72px leftward threshold on release: emit `remove.emit(notification().id)` and animate off-screen; under threshold: spring `dragX` back to 0 (CSS transition, not JS animation).
- `(click)` on the root (only fires for an actual tap, not a drag-then-release past threshold — guarded by a "did this pointer session move beyond a small slop" flag) emits `open.emit(notification())`.
- Keeps the existing hover-visible ✕ button (desktop/non-touch affordance, unchanged visibility behavior) alongside the swipe gesture; its click also emits `remove.emit(notification().id)` — same output, so the panel wires it to `store.requestRemove(id)` exactly once and both input methods get the same undo behavior.
- Avatar-vs-dot rendering: unchanged from the current template.

**`NotificationToastComponent`** (new, root-mounted)
- Injects `NotificationStore`, `DestroyRef`.
- `@if (store.pendingToast(); as n)` renders a small fixed-position card (reuses the existing `--z-toast` token).
- `constructor` `effect()`: whenever `pendingToast()` changes to non-null, `setTimeout(() => store.dismissToast(), 4000)`, storing the handle; clears the previous handle first (guards overlapping timers if a second notification arrives before the first toast finishes). `DestroyRef.onDestroy(() => clearTimeout(handle))` for cleanup — no manual `subscribe()`, so no `takeUntilDestroyed` needed.
- Click anywhere on the toast calls `store.dismissToast()` immediately.
- Mounted once — in `app.ts`, next to (not inside) wherever `NotificationPanelComponent`/header currently lives, since it must render above all routes regardless of which page is active.

**`RelativeTimePipe`** (`shared/pipes/relative-time.pipe.ts`)
- Pure, `pure: true` (default), no DI. `transform(timestamp: number): string` using `Intl.RelativeTimeFormat('en', { numeric: 'auto' })`. Only handles within-a-day granularity ("5 min ago", "2 hr ago", "just now"); day-level grouping ("Today"/"Yesterday") is the store's `groupedItems()` concern, not this pipe's.

## 6. Error handling & edge cases

- No new I/O; `localStorage` persistence is unchanged (already handled by `StorageService`).
- `pointercancel` (OS gesture interrupt) is treated identically to an under-threshold release: spring back to 0.
- Cap-at-100 eviction can silently drop an unread item never seen. Accepted trade-off — matches existing `add()` semantics, just bounded now.
- A filter tab with zero items still renders (not hidden), so counts stay comparable; the empty state under it is reworded per active filter.
- `pendingToast` (new arrival) and `undoEntry` (pending removal) are independent state — both can be visible at once with no de-duplication needed, since they render from two different fixed-position components.
- Item swipe (horizontal) vs. mobile sheet drag-to-close (vertical) don't conflict: the item only captures the gesture once horizontal intent is established via the `abs(deltaX) > abs(deltaY)` check; otherwise it releases and the sheet's own vertical handling (or page scroll) proceeds normally.

## 7. Open question for implementation time

RTL: this app doesn't currently appear to support RTL layouts (not confirmed either way during this design pass). Swipe direction is specified above as left-to-right revealing a delete affordance on the right — if RTL support exists or is planned, this should mirror. Flagging so the implementer checks `dir` handling in `shared/` before hardcoding a direction; not blocking for this spec since no existing RTL infrastructure was found in the codebase during this design session.

## 8. Testing plan

Vitest via `@angular/build:unit-test`, co-located `.spec.ts` files, matching existing patterns (see `active-call.store.spec.ts`).

- `notification.store.spec.ts` (extend existing or create if none exists — confirm at implementation time): cap-at-100 eviction on `add()`/`addUserEvent()`; `visibleItems()`/`groupedItems()` bucketing with a mocked `Date.now()`; `requestRemove` → `undoRemove` restores without hitting the timer; `requestRemove` → timer expiry commits the removal via `remove(id)`; `filterCounts()` correctness across all six buckets; `pendingToast` only sets when `isOpen()` is false at `add()` time.
- `relative-time.pipe.spec.ts`: "just now", "5 min ago", "2 hr ago" boundaries.
- `notification-item.component.spec.ts`: swipe past threshold emits `remove`; under-threshold snaps back; plain click emits `open`; `pointercancel` snaps back; avatar vs. dot branch.
- `notification-panel.component.spec.ts`: open transition calls `markAllRead()` exactly once (not on every change while already open); escape key closes; focus trap present when open.
- `notification-toast.component.spec.ts`: shows on `pendingToast()` change; auto-dismisses after 4s (fake timers); timer cleared on destroy and on rapid re-arrival.

## 9. Files touched (summary)

- **New:** `shared/ui/notification-panel/notification.model.ts`, `notification-filter-tabs.component.ts`, `notification-day-group.component.ts`, `notification-item.component.ts`, `notification-toast.component.ts`, `shared/pipes/relative-time.pipe.ts`
- **Changed:** `store/notification.store.ts` (filter/grouping/undo/toast state, cap, re-export model), `shared/ui/notification-panel/notification-panel.component.ts` (shell thinning, focus trap, bottom sheet, mobile breakpoint), `shared/ui/notification-panel/index.ts` (re-exports), `app.ts` (mount `NotificationToastComponent`)
- **Unchanged:** `core/layout/header.component.ts` (bell button/badge — already reads `unreadCount()`, no change needed), producer call sites from the 2026-07-01 spec.
