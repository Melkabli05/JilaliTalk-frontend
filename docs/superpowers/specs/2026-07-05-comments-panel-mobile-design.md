# Comments Panel — Mobile Improvements

**Date:** 2026-07-05
**Scope:** `src/app/features/room/feature/comments/{comment-list,comment-input}.{ts}` plus one new co-located dumb component (`swipeable-bubble.component.ts`). The mobile video-room/voice-room layout allocations and the panel's overall mobile/touch behavior are deliberately out of scope (separate, larger spec).

## 1. Goals

1. **Chat-style mobile bubbles**: own messages align right at `max-width: 75%` with the existing primary tint; others align left with the avatar + nickname visible above the bubble. Desktop unchanged (current single-style, 500px-wide column).
2. **Swipe-to-reply** on mobile: right-to-left swipe past 60px emits the same `(reply)` output the inline button currently emits. Inline copy button stays on mobile (one-tap affordance).
3. **Multi-line auto-grow input**: `<input>` → `<textarea>` that grows from 1 line up to 4 lines, then becomes internally scrollable. Enter sends; Shift+Enter (or IME composition) inserts a newline.
4. **Touch targets**: bubble action icons (copy) bump to 32×32 on mobile; the existing 16px input font-size rule (iOS Safari auto-zoom) is preserved.

## 2. Non-goals

- **No layout/allocation changes for mobile voice room or video room.** The video-room `display: none` under 1024px and the voice-room `22cqh` panel allocation stay as-is. They are correct problems to solve, but in a separate spec.
- **No new i18n**, no new pipes/util changes. Just CSS adjustments and one component-shape change (`<input>` → `<textarea>`) plus one new dumb component.
- **No persistence of unsent draft text** beyond the textarea's natural value.
- **No vertical-tab scrolling** for the comment list (it already scrolls fine inside its `overflow-y: auto` container).
- **No new tests** (user standing instruction: skip unit tests; the existing `comments-panel` / related specs continue to pass since the template shape changes are minimal — one element swap and one child component added).

## 3. Deviations from first-draft ideas (decided during exploration)

1. **No new files for the gesture.** An earlier draft floated putting the swipe state in a `Map<id, signal>` on the parent `CommentListComponent`. That bloats the parent's render path with per-row map mutations and re-evaluations. The chosen shape is a small **dumb child component** `SwipeableBubbleComponent` that owns its own gesture lifecycle (cleans up on `@for` row removal) — the same pattern `NotificationItemComponent` already uses for its swipe-to-dismiss (introduced earlier this session). ~70 lines including styles.
2. **Container query, not media query.** Both `CommentsPanelComponent` (which declares `container-name: comments-panel`) and `CommentListComponent` already use `@container` queries for other rules. New mobile-only styles use `@container comments-panel (max-width: 1023.98px)` for consistency with the existing convention in this codebase.
3. **No new "reply gesture discoverability" affordance beyond the in-bubble reveal.** The inline reply button is *hidden* on mobile (gesture replaces it), but the in-drag `<span class="reply-affordance">↩</span>` (already covered in §5) gives the user real-time feedback that the gesture is recognized. No persistent "hint" UI is added — those accumulate noise.

## 4. File layout

No new top-level files. One new co-located dumb component:

```
src/app/features/room/feature/comments/
├── comments-panel.ts              CHANGED — `<input>` → `<textarea>` is wired via the existing
│                                     [replyTo]/(send)/(typing)/(cancelReply) outputs — no
│                                     architectural change.
├── comment-list.ts                CHANGED — mobile-only @container styles for chat-style
│                                     bubble alignment + swipe gesture; existing template
│                                     structure is reused.
├── comment-input.ts               CHANGED — `<input>` → `<textarea>` with auto-grow;
│                                     multi-line styles; existing emoji-picker handling kept.
├── swipeable-bubble.component.ts  NEW — dumb; [commentId] in, (reply) out. Owns the
│                                     touch gesture + translateX signal.
└── comments-store.ts              unchanged
```

No upward/sideways imports. `swipeable-bubble.component.ts` only imports from `@angular/core` and `@lucide/angular` (for the reply-arrow icon), no feature-internal cross-imports.

## 5. Detailed changes

### 5.1 `comment-input.ts` — input → textarea

- Replace `<input class="comment-input" type="text" ...>` with `<textarea class="comment-input" rows="1" ...>`. The existing `enterkeyhint="send"`, `autocapitalize="sentences"`, `autocorrect="on"` carry over. The existing `enterkeyhint="send"` causes the mobile soft keyboard to label Enter as "Send".
- New method `private autoResize(textarea: HTMLTextAreaElement): void` called from the existing `(input)` handler: sets `style.height = 'auto'`, then `style.height = textarea.scrollHeight + 'px'`. Cap via a CSS `max-height` rule (line-height × 4) on the textarea; beyond that, the field becomes internally scrollable.
- Enter behavior: in the existing `(keydown.enter)` handler, check `event.shiftKey` and `event.isComposing`. If either is true, call `event.preventDefault()`, insert `\n` at the textarea's current `selectionStart`, dispatch a synthetic `input` event so the auto-resize recomputes, and let the textarea grow. Otherwise send as today.
- Use native CSS `field-sizing: content` where supported, with a `ResizeObserver` fallback in `autoResize()` for older Safari/Android webview.
- Mobile styles (existing `@media (max-width: 1023.98px)` block): the previous `font-size: var(--text-base)` override on `.comment-input` no longer applies to `<input>` — it stays for `<textarea>` (16px still matters for iOS auto-zoom on focus). Set `min-height: 40px` on the textarea so the input row height doesn't jitter between empty (1 line) and one-line content. The existing button-size bumps (`emoji-btn`, `send-btn` at 40×40) stay.
- The `(send)` / `(typing)` / `(cancelReply)` outputs and the emoji-picker handling remain untouched. The existing `static readonly TYPING_THROTTLE_MS = 800` typing-indicator throttle handles the IME composition case (composition events fire as `input` events, throttle takes care of rate).

### 5.2 `comment-list.ts` — mobile chat bubbles

Add a new `@container comments-panel (max-width: 1023.98px)` block. New rules:

- `.bubble` becomes `max-width: 75%`, `display: block` (was `inline-block`); on desktop the existing single-style layout is unchanged.
- `.group` is the flex row holding avatar + body. Add `.group.own { align-items: flex-end; }` (already exists implicitly via the `[class.own]` binding on the message, but the group itself needs alignment). The body stays left-aligned inside but the row is right-anchored.
- `.group-meta.own { justify-content: flex-end; }` to push the name/time chips to the right edge of the right-aligned row. Keep the name+time above the bubble (the typical chat-app convention) for both own and other — no need to invert meta and bubble order.
- `.actions .action-btn { width: 32px; height: 32px; }` on mobile (was 22×22 on desktop), so the kept-inline copy button is thumb-friendly. The reply button (`(click)="onReply(comment)"`) is **hidden** on mobile via `display: none` on the action container — replaced by the swipe gesture.

The existing template has the structural pieces needed:
- `<div class="message" [class.own]="isSelfGroup(row.group)" ...>` — owns the row.
- `<div class="bubble" [class.own]="..." ...>` — the bubble itself.
- `.actions` already exposes both Copy and Reply with `[class.is-muted]`/aria-label etc. Hide Reply on mobile via CSS only (no template change needed).
- `.reply-quote` (the "Replying to X" snippet above the bubble) — kept as-is, still clickable on both platforms.
- `.reply-quote__label`, `.reply-quote__text` — no change.

### 5.3 `swipeable-bubble.component.ts` (new, ~70 lines)

Dumb component pattern matching `NotificationItemComponent`'s swipe shape:

```ts
// pseudo-shape — full implementation goes in the plan, not the spec
const SWIPE_THRESHOLD_PX = 60;
const SWIPE_SLOP_PX = 10;

@Component({
  selector: 'app-swipeable-bubble',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="message"
      [style.transform]="dragX() ? 'translateX(' + dragX() + 'px)' : null"
      [style.transition]="dragging() ? 'none' : null"
      (touchstart)="onTouchStart($event)"
      (touchmove)="onTouchMove($event)"
      (touchend)="onTouchEnd($event)"
      (touchcancel)="onTouchEnd($event)"
    >
      <ng-content />
      <span class="reply-affordance" [style.opacity]="Math.min(1, -dragX() / SWIPE_THRESHOLD_PX)" aria-hidden="true">
        <svg lucideCornerUpLeft [size]="14" />
      </span>
    </div>
  `,
  // styles: .message { position: relative; touch-action: pan-y; }
  //         .reply-affordance { position: absolute; right: -36px; top: 50%; transform: translateY(-50%); color: ...; }
  //         @media (prefers-reduced-motion: no-preference) { .message { transition: transform 0.18s ease-out; } }
})
export class SwipeableBubbleComponent {
  readonly commentId = input.required<string>();
  readonly reply = output<string>();

  readonly dragX = signal(0);
  readonly dragging = signal(false);
  private touchStartX = 0;
  private touchStartY = 0;
  private didSwipe = false;

  onTouchStart(event) { /* same shape as NotificationItemComponent */ }
  onTouchMove(event) {
    if (Math.abs(deltaY) > Math.abs(deltaX)) return;  // vertical scroll wins
    if (Math.abs(deltaX) > SWIPE_SLOP_PX) this.didSwipe = true;
    if (deltaX < 0) this.dragX.set(deltaX);
  }
  onTouchEnd(event) {
    if (!this.dragging()) return;
    this.dragging.set(false);
    if (event.changedTouches[0].clientX - this.touchStartX < -SWIPE_THRESHOLD_PX) {
      this.reply.emit(this.commentId());
    } else {
      this.dragX.set(0);
    }
  }
}
```

- The component renders the existing `.message` content via `<ng-content>` projection, so `comment-list.ts` only needs to wrap each `.message` block in `<app-swipeable-bubble [commentId]="comment._id" (reply)="onReply(comment)">`. Two single-line wrap edits.
- On desktop, touch events don't fire from a mouse — gestures are no-ops for free; no `if (isMobile)` guard needed.
- `touch-action: pan-y` on `.message` lets the list's vertical scroll pass through.

### 5.4 `comments-panel.ts`

No change. The existing `(reply)` output from `CommentListComponent` is already wired through `onReply(comment)` → `replyTarget.set(comment)`. The new `SwipeableBubbleComponent`'s `(reply)` output, bubbled up via `CommentListComponent`, feeds the same handler unchanged.

## 6. Edge cases & error handling

- **Whitespace-only messages**: existing `submit()` already does `text.trim()` and gates the send. No change.
- **Multi-line cap**: 4 lines (`max-height: ~96px` via line-height × 4). Beyond that, the textarea becomes internally scrollable. User can review long content before sending.
- **IME composition**: `event.isComposing` checked in the Enter handler. Composition events fire as `input` events; the existing 800ms typing throttle handles the rate.
- **Swipe during active emoji-picker**: independent (gesture on the bubble, not the input). No conflict.
- **Swipe during vertical scroll of the list**: `abs(deltaY) > abs(deltaX)` releases the gesture without consuming the event. List scrolls normally.
- **Pointer cancel**: snap back to `dragX = 0`.
- **Reduced motion**: the snap-back CSS `transition: transform 0.18s ease-out` is wrapped in `@media (prefers-reduced-motion: no-preference)` so motion-sensitive users get an instant reset. Same pattern as the rest of this codebase.
- **Dark mode**: no new color values. Existing `.bubble.own` color rules apply unchanged; chat alignment is structural.
- **Accessibility**:
  - The reply affordance (`<span>` with the corner-up-left icon) is `aria-hidden="true"` — pure visual feedback during drag.
  - The inline reply button is *only* hidden on mobile; desktop/keyboard users still get it.
  - The reply-quote's "Jump to original" click action remains intact and accessible on both platforms.
  - Screen-reader note (flagged for verification at implementation time): mobile screen-reader users typically rely on the inline buttons for action discovery; the gesture is a power-user shortcut. Long-term, a swipe-action via the row's accessibility properties would be ideal, but that's out of scope for this pass.

## 7. Manual verification checklist (final pass)

- Mobile viewport (390×844): own bubbles right-aligned at 75% width with primary tint; other bubbles left-aligned with avatar + name visible; bubbles wrap, never exceed 75% width.
- Multi-line input: type 5 lines — textarea grows to 4 lines, then becomes internally scrollable.
- Send Enter normally: message posted, textarea clears, height resets to 1 line.
- Send Shift+Enter: newline inserted, no send.
- Send Enter during IME composition: newline inserted, no send.
- Swipe right-to-left past 60px: reply affordance fades in, bubble slides, on release `replyTarget` is set and the reply-preview banner appears in the input row.
- Swipe under threshold: bubble springs back (or instantly resets with `prefers-reduced-motion`), no reply.
- Vertical scroll inside the comment list still works while a partial swipe is mid-drag (no jank, no event capture).
- `prefers-reduced-motion: reduce` set in OS: snap-back is instant, not animated.
- Desktop viewport: bubble alignment unchanged (left-aligned, single style). Reply button still inline. Copy button still inline.
- Dark mode: own bubble color matches existing `--color-primary-600` background, no contrast regression.
- Existing tests: `comments-panel.spec.ts` and related specs continue to pass (template shape change is minimal: one element swap and one child component added).
- `npx tsc --noEmit` clean, `npx ng build --configuration development` succeeds (only the pre-existing Sass `@import` deprecation warnings).

## 8. Out of scope / deferred

- **Mobile layout allocation** (video-room `display: none`, voice-room `22cqh`) — a separate, larger spec. This spec deliberately narrows scope to chat-style bubbles and the input row, which both work within whatever allocation the room decides on.
- **Draft persistence**: textarea value already persists for the lifetime of the page; cross-session persistence is a separate concern.
- **Swipe-to-delete or swipe-to-pin**: not requested, not implemented.