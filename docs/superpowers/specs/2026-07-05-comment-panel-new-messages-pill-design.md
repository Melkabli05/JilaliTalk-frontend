# Comments Panel — "X new messages ↓" Pill

**Date:** 2026-07-05
**Scope:** `src/app/features/room/feature/comments/{comments-store.ts, comment-list.ts}`. Two files, no new files, no new event types. Deliberately narrow — focused on the in-room, in-panel unread indicator only.

## 1. Goals

1. **In-list "X new messages ↓" pill** anchored at the bottom of the comment list, visible only when there are comments newer than the user's last "caught-up" position.
2. **Always show** the pill while count > 0. No auto-scroll, no scroll-driven reset — the user clicks the pill (or already be at the bottom — but pill still shows) to acknowledge.
3. **Click jumps to the bottom** of the list and resets the count to 0.
4. **Counter is timestamp-based**: counts items in `mergedItems` whose `ts > lastReadTs`, where `lastReadTs` is updated to `Date.now()` on click (or on `addComment` if the user is already at the bottom). EventCards (gifts, joins, follows) are NOT counted as "messages" — they are events about people, not conversation; the pill is specifically about new text to read.
5. **Resets cleanly** on room entry, on `clear()`, and on pill click. Persists across panel close/reopen within the same room session (the page-scoped `CommentsStore` outlives the panel component's mount).

## 2. Non-goals

- **No auto-scroll**, no scroll-driven reset, no "you're typing nearby" badges, no sound.
- **No new event type** — the existing `comment` event over `BffRoomSocketService` is the only source of new-comment signals.
- **No minimized-bar / cross-route indicator** — separate spec.
- **No global notification toast** on new comment.
- **No unread badge on the comments section title** — only the in-list pill is in scope.

## 3. File layout

```
src/app/features/room/feature/comments/
├── comments-store.ts        CHANGED — new `unreadCount` signal (number), `lastReadTs`
│                                signal (number, ms epoch), updated inside the existing
│                                `addComment(...)` call site; new `resetUnread()`
│                                method; `clear()` already resets them.
└── comment-list.ts          CHANGED — new `<app-new-messages-pill>` inline presentational
                              component (~30 lines including styles, defined at the
                              bottom of this file next to `CommentListComponent`); new
                              computed `unreadCount` derived from the store; new click
                              handler scrolls to bottom + calls `resetUnread()`.
```

No new files. Per CLAUDE.md §1 / §6, a 30-line dumb component that depends on feature-specific state belongs inline next to its parent. (`NotificationItemComponent` was extracted earlier this session because it owns a non-trivial gesture lifecycle; this pill is just a button + count + scroll call.)

## 4. Store contract

```ts
// store/comments-store.ts — additions
export class CommentsStore extends CollectionStore<Comment> {
  // existing
  readonly collection: Signal<readonly Comment[]>;
  readonly mergedItems: Signal<readonly CommentOrEvent[]>;
  addComment(c: NewCommentParams): void;
  updateComments(items: Comment[]): void;
  reset(): void;
  // (private) lastReadTs: number
  // (private) unreadCount: number

  // new
  readonly unreadCount: Signal<number>;          // exposed as readonly signal
  resetUnread(): void;                            // sets lastReadTs = Date.now(), unreadCount = 0

  // internal
  private _lastReadTs = signal(Date.now());
  private _unreadCount = signal(0);
}
```

**Increment rule** in the existing `addComment(...)` method (around line 165 in `comments-store.ts`):
- If `comment.createdAtMs > _lastReadTs()`, increment `_unreadCount` by 1.
- If `comment.createdAtMs <= _lastReadTs()`, do nothing (this is a backfill — e.g., history loaded after a refresh; not "new" by the user's POV).

**Reset rule** in `resetUnread()`:
- Set `_lastReadTs = Date.now()`.
- Set `_unreadCount = 0`.

**Reset rule** in `clear()` (the existing method that runs on room leave / unmount):
- Also reset `_lastReadTs` and `_unreadCount` (so a re-mount starts at 0).

**Reset rule** on `updateComments(...)` (full refresh / pagination):
- Do NOT reset — these are backfilled history items, same logic as `addComment`: only count items with `createdAtMs > _lastReadTs`.

The point of the timestamp comparison is: backfill vs. live is the same code path; the only question is "is this comment newer than the last time the user acknowledged."

## 5. Component contract

```ts
// comment-list.ts — additions
export class CommentListComponent {
  // existing
  readonly items = input<readonly CommentOrEvent[]>([]);
  readonly currentUserId = input<number>(0);
  readonly reply = output<Comment>();
  readonly scrollContainer = viewChild<ElementRef<HTMLDivElement>>('scrollContainer');

  // new
  protected readonly unreadCount = computed(() => {
    const list = this.items();
    const since = this.commentsStore.lastReadTs();
    let n = 0;
    for (const item of list) {
      if (item.type !== 'comments') continue;       // skip EventCards
      if (item.ts > since) n++;
    }
    return n;
  });

  onNewMessagesPillClick(): void {
    const container = this.scrollContainer()?.nativeElement;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    this.commentsStore.resetUnread();
  }
}
```

The pill itself is a small inline component defined in the same file (next to `CommentListComponent`). It's strictly presentational: takes `count: number` input and `(click): void` output, renders a fixed-position button at the bottom of the scroll container with the count + a down-arrow icon. ~30 lines total including styles.

The pill is positioned **inside** `.comment-list` (the existing scroll container), `position: sticky; bottom: 0` (with the container's `overflow-y: auto` providing the scroll context), so it stays anchored at the bottom of the visible list area as the user scrolls. This matches WhatsApp/Slack/Telegram patterns — the pill floats above the list content, not below it.

**Visibility** is `@if (unreadCount() > 0) { <app-new-messages-pill [count]="unreadCount()" (click)="onNewMessagesPillClick()" /> }`. Pill is hidden when count is 0 (no visual noise for users keeping up in real time).

## 6. Edge cases & error handling

- **Backfilled history on first load**: `addComment(...)` is called for every comment in the initial bundle (`updateComments` calls `addComment` internally per the existing implementation — verify by reading `comments-store.ts:165-189` + `updateComments` at line 314). Each call hits the increment rule; since `lastReadTs` starts at `Date.now()` at construction time, all backfilled items (created before that) are `createdAtMs <= lastReadTs` and the count stays at 0. New items arriving over the socket after construction have `createdAtMs > lastReadTs` and count.
- **Count = 0 on entry**: the pill is hidden via `@if`, so no flashing for users who land on a freshly-loaded room.
- **Rapid bursts** (10 comments in 2s): each call increments by 1, so count reaches 10. Pill shows "10 new messages ↓". Click resets once.
- **User clicks pill but list isn't fully scrolled to bottom**: the existing `scrollContainer` ref + `scrollTo({ top: scrollHeight })` scrolls all the way. `behavior: 'smooth'` respects `prefers-reduced-motion` in modern browsers.
- **Clicking during a comment in flight (a comment arrives between click and scroll completing)**: the new comment's `addComment` call increments after `resetUnread()` has run, so it shows as 1 again. Acceptable — the comment really is new.
- **User opens a different room in the same tab**: `clear()` runs on the old store, resetting the count. The new room's store is a fresh instance (page-scoped provider), starts at 0. Correct.
- **Refresh / F5**: a new `CommentsStore` instance is constructed, `lastReadTs = Date.now()` at that moment, history loaded into it doesn't increment (per backfill rule), pill stays hidden. Correct.
- **Reduced motion**: smooth-scroll falls back to instant scroll per browser default; the pill is `aria-hidden` only on the icon, the button itself remains keyboard-focusable.
- **Dark mode**: existing token palette; no new colors.
- **Accessibility**: pill is a real `<button type="button">` with `aria-label="Scroll to newest messages, {count} new"` so screen readers announce the count + the action. Enter/Space activate (native button behavior).

## 7. Testing plan (skip unit tests per user standing instruction)

- `tsc --noEmit` clean after each task.
- `ng build` clean (only the pre-existing Sass `@import` warnings).
- Existing test suite (`ng test`) passes — no regressions.
- Manual verification in a real browser session via `/run` skill:
  - Open a room with 5+ existing comments (backfilled) → pill stays hidden, count stays 0.
  - Have a second account post a comment → pill appears with "1 new message ↓".
  - Post 5 more → pill shows "6 new messages ↓".
  - Click pill → list scrolls to bottom, pill disappears.
  - After scroll, post another → pill shows "1 new message ↓" again.
  - Refresh the page → pill stays hidden (history doesn't count).
  - Mobile viewport (390×844): pill visible at the bottom of the list area, doesn't overlap the input row, doesn't break scroll.
  - Keyboard tab to pill → focus ring visible; Enter activates.
  - Screen reader (NVDA/VoiceOver) reads "Scroll to newest messages, 6 new" on focus.

## 8. Out of scope / deferred

- **Minimized-bar unread counter** — separate spec.
- **Comments section title badge** — could add a `Comments (3 new)` later; deferred to keep this spec tight.
- **Auto-scroll** when at-bottom — user explicitly chose "always show pill" instead.
- **Sound / vibration** — silence per existing convention.