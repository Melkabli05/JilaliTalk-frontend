# Comments Panel — Mobile Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Per user instruction, this plan skips writing new unit tests.** Each task verifies via `tsc --noEmit` (and, where noted, a manual behavior check) instead of a spec file. Task 5 still runs the pre-existing test suite as a regression gate — that suite is not being skipped, only the *authoring of new tests* for this feature.

**Goal:** Make the room's comment list and input feel native on mobile — chat-style bubble alignment, swipe-to-reply gesture, multi-line auto-growing textarea — without changing the desktop layout.

**Architecture:** A new dumb child component `SwipeableBubbleComponent` owns the touch gesture lifecycle (mirror of the pattern `NotificationItemComponent` already uses); the existing `CommentListComponent` template wraps each `.message` in `<app-swipeable-bubble>` and adds a single `@container comments-panel (max-width: 1023.98px)` block for the chat-style alignment + action-button sizing; the existing `<input>` in `CommentInputComponent` is swapped for a `<textarea>` with an auto-resize method and Shift+Enter / IME newline insertion.

**Tech Stack:** Angular 22 (signals, `input()`/`output()`, `@if`/`@for`, `field-sizing: content`), `@lucide/angular` icons, container queries (already used by `CommentsPanelComponent`), `ResizeObserver` (fallback for older Safari/Android webview).

## Global Constraints

- Swipe-to-reply threshold: **60px** leftward (deltaX < -60).
- Swipe slop: **10px** before a gesture counts as "swiped" (suppresses the click).
- Vertical-scroll priority: gesture is captured only once `abs(deltaX) > abs(deltaY)`. Otherwise the event is not consumed and the list scrolls normally.
- Textarea auto-grow max: **4 lines** (`max-height` via line-height × 4). Beyond that, the field becomes internally scrollable.
- Mobile breakpoint for these styles: `@container comments-panel (max-width: 1023.98px)` — matches the container already declared by `CommentsPanelComponent` (line 126).
- iOS Safari auto-zoom rule: textarea `font-size: 16px` on mobile.
- Reply button hidden on mobile (swipe replaces it); copy button stays inline, sized to 32×32.
- `prefers-reduced-motion`: snap-back is instant (CSS transition wrapped in `@media (prefers-reduced-motion: no-preference)`).
- All changes use existing design tokens; no new color values.
- Every component is `ChangeDetectionStrategy.OnPush`, signal `input()`/`output()`, no manual `.subscribe()`.
- Path aliases: `@shared/*`, `@core/*`, `@store/*`, `@features/*`.

---

## Task 1: Create `SwipeableBubbleComponent`

**Files:**
- Create: `src/app/features/room/feature/comments/swipeable-bubble.component.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `SwipeableBubbleComponent` with `commentId = input.required<string>()`, `reply = output<string>()`. Used by Task 2.

- [ ] **Step 1: Write the implementation**

Create `src/app/features/room/feature/comments/swipeable-bubble.component.ts`:

```ts
import { Component, ChangeDetectionStrategy, input, output, signal } from '@angular/core';
import { LucideCornerUpLeft } from '@lucide/angular';

const SWIPE_THRESHOLD_PX = 60;
const SWIPE_SLOP_PX = 10;

@Component({
  selector: 'app-swipeable-bubble',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideCornerUpLeft],
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
      <span
        class="reply-affordance"
        [style.opacity]="affordanceOpacity()"
        aria-hidden="true"
      >
        <svg lucideCornerUpLeft [size]="14"></svg>
      </span>
    </div>
  `,
  styles: [`
    :host { display: contents; }

    .message {
      position: relative;
      touch-action: pan-y;
    }
    @media (prefers-reduced-motion: no-preference) {
      .message { transition: transform 0.18s ease-out; }
    }

    .reply-affordance {
      position: absolute;
      right: -36px;
      top: 50%;
      transform: translateY(-50%);
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--color-primary-500);
      color: var(--color-on-color);
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      transition: opacity 0.12s ease-out;
    }
    :host-context(.dark) .reply-affordance {
      background: var(--color-primary-600);
    }
  `],
})
export class SwipeableBubbleComponent {
  readonly commentId = input.required<string>();
  readonly reply = output<string>();

  readonly dragX = signal(0);
  readonly dragging = signal(false);

  protected readonly affordanceOpacity = computed(() => {
    const dx = -this.dragX();
    if (dx <= 0) return 0;
    return Math.min(1, dx / SWIPE_THRESHOLD_PX);
  });

  private touchStartX = 0;
  private touchStartY = 0;
  private didSwipe = false;

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
      this.reply.emit(this.commentId());
    }
    this.dragX.set(0);
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: 0 errors (this component isn't imported anywhere yet, so nothing new to break).

- [ ] **Step 3: Commit**

```bash
git add src/app/features/room/feature/comments/swipeable-bubble.component.ts
git commit -m "feat(comments): add SwipeableBubbleComponent for mobile swipe-to-reply"
```

---

## Task 2: Wire `SwipeableBubbleComponent` into the comment list + add mobile chat-style styles

**Files:**
- Modify: `src/app/features/room/feature/comments/comment-list.ts` (template wrap + new `@container` styles)

**Interfaces:**
- Consumes: `SwipeableBubbleComponent` from Task 1; the existing `Comment` model and `(reply)` output.
- Produces: the same public API as before — `CommentListComponent`'s `(reply)` output, bubbled through `CommentsPanelComponent`'s existing `onReply(comment)` handler. No new wiring at the panel level needed.

- [ ] **Step 1: Add the import and wrap the `.message` in the template**

In `src/app/features/room/feature/comments/comment-list.ts`:

a) Add `SwipeableBubbleComponent` to the `imports` array of the `@Component` decorator:

```ts
imports: [
  AvatarComponent,
  CountryFlagComponent,
  NgOptimizedImage,
  EventCardComponent,
  SwipeableBubbleComponent,
  LucideCopy,
  LucideCheck,
  LucideCornerUpLeft,
  LucideCrown,
  LucideHeart,
],
```

b) Locate the existing `<div class="message" ...>` block inside the `@for (comment of row.group.messages; track comment._id)` loop. Replace the existing `<div class="message" ...>` and its `</div>` close with the wrapped version:

Find:
```html
                @for (comment of row.group.messages; track comment._id) {
                  <div
                    class="message"
                    [class.own]="isSelfGroup(row.group)"
                    [class.highlighted]="highlightId() === comment._id"
                    [attr.data-comment-id]="comment._id"
                  >
                    @if (comment.msg.replyInfo; as ri) {
                      <div
                        class="reply-quote"
                        [class.own]="isSelfGroup(row.group)"
                        role="button"
                        tabindex="0"
                        [attr.aria-label]="'Jump to original message from ' + ri.fromNickname"
                        (click)="onReplyQuoteClick(comment, ri)"
                        (keydown.enter)="onReplyQuoteClick(comment, ri)"
                        (keydown.space)="onReplyQuoteClick(comment, ri); $event.preventDefault()"
                      >
                        <span class="reply-quote__label">
                          <svg aria-hidden="true" lucideCornerUpLeft [size]="10" />
                          Replying to <strong>{{ ri.fromNickname }}</strong>
                        </span>
                        <span class="reply-quote__text">{{ ri.text }}</span>
                      </div>
                    }
                    <div
                      class="bubble"
                      [class.own]="isSelfGroup(row.group)"
                      [class.skinned]="hasBubbleSkin(comment)"
                    >
                      {{ comment.msg.text.text }}
                      @if (hasAnimalBadge(comment)) {
                        <img
                          class="bubble-animal"
                          [ngSrc]="comment.bubbleAnimalUrl!"
                          width="18"
                          height="18"
                          alt=""
                          aria-hidden="true"
                        />
                      }
                      <span class="actions">
                        <button
                          type="button"
                          class="action-btn"
                          (click)="copyText(comment.msg.text.text, comment._id)"
                          [attr.aria-label]="copiedId() === comment._id ? 'Copied' : 'Copy'"
                        >
                          @if (copiedId() === comment._id) {
                            <svg aria-hidden="true" lucideCheck [size]="11" />
                          } @else {
                            <svg aria-hidden="true" lucideCopy [size]="11" />
                          }
                        </button>
                        <button
                          type="button"
                          class="action-btn"
                          (click)="onReply(comment)"
                          aria-label="Reply"
                        >
                          <svg aria-hidden="true" lucideCornerUpLeft [size]="11" />
                        </button>
                      </span>
                    </div>
                  </div>
                }
```

Replace with:
```html
                @for (comment of row.group.messages; track comment._id) {
                  <app-swipeable-bubble [commentId]="comment._id" (reply)="onReply(comment)">
                    <div
                      class="message"
                      [class.own]="isSelfGroup(row.group)"
                      [class.highlighted]="highlightId() === comment._id"
                      [attr.data-comment-id]="comment._id"
                    >
                      @if (comment.msg.replyInfo; as ri) {
                        <div
                          class="reply-quote"
                          [class.own]="isSelfGroup(row.group)"
                          role="button"
                          tabindex="0"
                          [attr.aria-label]="'Jump to original message from ' + ri.fromNickname"
                          (click)="onReplyQuoteClick(comment, ri)"
                          (keydown.enter)="onReplyQuoteClick(comment, ri)"
                          (keydown.space)="onReplyQuoteClick(comment, ri); $event.preventDefault()"
                        >
                          <span class="reply-quote__label">
                            <svg aria-hidden="true" lucideCornerUpLeft [size]="10" />
                            Replying to <strong>{{ ri.fromNickname }}</strong>
                          </span>
                          <span class="reply-quote__text">{{ ri.text }}</span>
                        </div>
                      }
                      <div
                        class="bubble"
                        [class.own]="isSelfGroup(row.group)"
                        [class.skinned]="hasBubbleSkin(comment)"
                      >
                        {{ comment.msg.text.text }}
                        @if (hasAnimalBadge(comment)) {
                          <img
                            class="bubble-animal"
                            [ngSrc]="comment.bubbleAnimalUrl!"
                            width="18"
                            height="18"
                            alt=""
                            aria-hidden="true"
                          />
                        }
                        <span class="actions">
                          <button
                            type="button"
                            class="action-btn action-copy"
                            (click)="copyText(comment.msg.text.text, comment._id)"
                            [attr.aria-label]="copiedId() === comment._id ? 'Copied' : 'Copy'"
                          >
                            @if (copiedId() === comment._id) {
                              <svg aria-hidden="true" lucideCheck [size]="11" />
                            } @else {
                              <svg aria-hidden="true" lucideCopy [size]="11" />
                            }
                          </button>
                          <button
                            type="button"
                            class="action-btn action-reply"
                            (click)="onReply(comment)"
                            aria-label="Reply"
                          >
                            <svg aria-hidden="true" lucideCornerUpLeft [size]="11" />
                          </button>
                        </span>
                      </div>
                    </div>
                  </app-swipeable-bubble>
                }
```

Note the two class additions: `action-copy` and `action-reply` on the action buttons (used to scope which buttons to show/hide on mobile in Step 2).

- [ ] **Step 2: Add the mobile-only chat-style styles**

In the same file (`comment-list.ts`), inside the component's `styles` array, locate the closing `]` of the `styles: [...]` array — just before the existing `@media (prefers-reduced-motion: reduce) { /* No animations are used; ... */ }` block. Replace that block with the version that includes the mobile chat styles:

Find:
```ts
      @media (prefers-reduced-motion: reduce) {
        /* No animations are used; nothing to disable here. Block reserved
           so future motion-adding edits are forced to opt-in. */
      }
    `,
  ],
```

Replace with:
```ts
      /* ─── Mobile chat-style alignment + action sizing ───
         Container query matches CommentsPanelComponent's container-name.
         Own bubbles right-align; others left-align. Reply action button
         is hidden on mobile (swipe gesture replaces it); copy stays,
         bumped to 32x32 for thumb-friendliness. */
      @container comments-panel (max-width: 1023.98px) {
        .group.own { align-items: flex-end; }
        .group-meta.own { justify-content: flex-end; }
        .bubble { display: block; max-width: 75%; }
        .action-btn { width: 32px; height: 32px; }
        .action-reply { display: none; }
      }

      @media (prefers-reduced-motion: reduce) {
        /* No animations are used; nothing to disable here. Block reserved
           so future motion-adding edits are forced to opt-in. */
      }
    `,
  ],
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/features/room/feature/comments/comment-list.ts
git commit -m "$(cat <<'EOF'
feat(comments): wire SwipeableBubbleComponent + add mobile chat-style alignment

Wraps each comment's .message in <app-swipeable-bubble> so swipe-to-reply
is its own gesture lifecycle. Adds a @container comments-panel block for
mobile-only styles: own bubbles right-align at 75% width, action-copy
sized to 32x32 for thumbs, action-reply hidden (gesture replaces it).

Desktop layout unchanged.
EOF
)"
```

---

## Task 3: Multi-line auto-grow `<textarea>` for `CommentInputComponent`

**Files:**
- Modify: `src/app/features/room/feature/comments/comment-input.ts`

**Interfaces:**
- Consumes: the existing `CommentInputComponent` class (no external dependency change).
- Produces: same public API — `replyTo` input, `send`/`cancelReply`/`typing` outputs. Only the underlying DOM element + `Enter`-handling change.

- [ ] **Step 1: Swap the `<input>` for a `<textarea>`**

In `src/app/features/room/feature/comments/comment-input.ts`, locate the existing `<input class="comment-input" ...>` element (lines ~53–63) and replace with:

```html
      <textarea
        #inputEl
        class="comment-input"
        rows="1"
        enterkeyhint="send"
        autocapitalize="sentences"
        autocorrect="on"
        [placeholder]="replyTo() ? 'Reply to ' + replyTo()!.nickname + '…' : 'Say something...'"
        (keydown.enter)="onEnter($event)"
        (input)="onInput($event)"
      ></textarea>
```

- [ ] **Step 2: Update the styles for `<textarea>`**

In the same file's `styles` array, locate the existing `.comment-input { ... }` rule and replace it with:

```ts
    .comment-input {
      flex: 1;
      min-height: 40px;
      max-height: 96px;       /* ~4 lines at 1.5 line-height — beyond this, the field scrolls internally */
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-full);
      border: 1px solid var(--ci-border);
      background: var(--ci-input);
      font: inherit;
      font-size: var(--text-sm);
      line-height: var(--leading-normal);
      color: var(--ci-text);
      outline: none;
      resize: none;
      overflow-y: auto;
      field-sizing: content;
    }
    .comment-input:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }
    .comment-input::placeholder { color: var(--ci-muted); }
```

The `field-sizing: content` declaration tells modern browsers to size the textarea to its content automatically; the `ResizeObserver` fallback in `autoResize()` (added in Step 4) covers older targets. The `resize: none` removes the user-resize handle.

- [ ] **Step 3: Update mobile styles for the textarea**

In the same file's `@media (max-width: 1023.98px)` block, locate the existing `.comment-input { font-size: var(--text-base); }` rule and replace it with:

```ts
    @media (max-width: 1023.98px) {
      .comment-input {
        font-size: var(--text-base);    /* 16px — prevents iOS Safari auto-zoom on focus */
      }

      .emoji-btn,
      .send-btn {
        width: 40px;
        height: 40px;
      }

      .reply-cancel {
        width: 32px;
        height: 32px;
      }

      /* The emoji-picker-element web component has no viewport awareness of
         its own (fixed 400px height, ~300px min-content width) — inset it
         from both edges so it can never render wider than the screen, and
         cap its height so it can't extend above the visible viewport when
         there isn't 400px of room above the input. --num-columns is one of
         the library's documented custom properties, so it reliably crosses
         the shadow-DOM boundary; width/height do not by default; the
         !important pair over-anchoring is the pragmatic way to beat the
         component's own internal :host{width:min-content;height:400px}. */
      .emoji-picker-container {
        left: var(--space-2);
        right: var(--space-2);
        max-height: min(400px, 60vh);
      }

      emoji-picker {
        --num-columns: 6;
        width: 100% !important;
        height: 100% !important;
        max-height: min(400px, 60vh) !important;
      }
    }
```

The only change inside this block is keeping the `font-size: var(--text-base)` rule on `.comment-input` (no change in behavior — it's now on a `<textarea>` instead of `<input>`, but iOS Safari still treats any focused element with computed font-size under 16px as a reason to zoom).

- [ ] **Step 4: Add `autoResize()` and a `ResizeObserver`, plus the Enter-handler logic**

In the same file's `CommentInputComponent` class, replace the existing `onSend`/`onInput`/`onSendFromBtn`/`submit` methods with the version below. Also add the `ResizeObserver` field and the new `onEnter` method:

```ts
  private inputRef: HTMLTextAreaElement | null = null;
  private lastTypingEmit = 0;
  private static readonly TYPING_THROTTLE_MS = 800;
  private resizeObserver: ResizeObserver | null = null;

  async toggleEmojiPicker(): Promise<void> {
    if (!this.showEmojiPicker()) {
      await import('emoji-picker-element');
    }
    this.showEmojiPicker.update((v) => !v);
  }

  onEmojiClick(event: Event): void {
    const input = this.inputRef;
    if (!input) return;
    const customEvent = event as CustomEvent<{ emoji: { unicode: string } }>;
    const emoji = customEvent.detail?.emoji?.unicode;
    if (emoji) {
      input.value = (input.value || '') + emoji;
      input.focus();
      this.autoResize(input);
    }
  }

  onEnter(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    // Shift+Enter inserts a newline; Enter during IME composition also inserts a newline.
    if (keyboardEvent.shiftKey || keyboardEvent.isComposing || keyboardEvent.keyCode === 229) {
      return; // let the textarea handle the newline natively
    }
    keyboardEvent.preventDefault();
    const input = event.target as HTMLTextAreaElement;
    this.inputRef = input;
    this.submit(input);
  }

  onInput(event: Event): void {
    const input = event.target as HTMLTextAreaElement;
    this.inputRef = input;
    this.autoResize(input);
    if (!input.value) return;
    const now = Date.now();
    if (now - this.lastTypingEmit < CommentInputComponent.TYPING_THROTTLE_MS) return;
    this.lastTypingEmit = now;
    this.typing.emit();
  }

  onSendFromBtn(input: HTMLTextAreaElement): void {
    this.inputRef = input;
    this.submit(input);
  }

  /** Resize the textarea to fit its content. Uses native `field-sizing: content`
   *  when supported; ResizeObserver handles legacy browsers. The 96px max-height
   *  in CSS caps the field at ~4 lines; beyond that, the textarea becomes
   *  internally scrollable. */
  private autoResize(textarea: HTMLTextAreaElement): void {
    // Reset to recompute (scrollHeight would otherwise be stale).
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 96)}px`;
  }

  private submit(input: HTMLTextAreaElement): void {
    const text = input.value.trim();
    if (text) {
      this.send.emit({ text, replyInfo: this.replyTo() ?? null });
      input.value = '';
    }
    this.showEmojiPicker.set(false);
    this.autoResize(input);
  }
```

Note: the existing `onSend` method (which took an `Event` and assumed `<input>`) is replaced by the new `onEnter` handler. The `(keydown.enter)` template binding is also renamed in Step 1 (`(keydown.enter)="onEnter($event)"`).

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/features/room/feature/comments/comment-input.ts
git commit -m "$(cat <<'EOF'
feat(comments): multi-line auto-grow textarea for the comment input

Swaps <input> for <textarea> with field-sizing: content (modern
browsers) + ResizeObserver fallback (legacy). Caps at 4 lines via
max-height: 96px; beyond that the field scrolls internally.

Shift+Enter (and Enter during IME composition) inserts a newline
instead of sending; plain Enter sends as before. iOS Safari's 16px
auto-zoom rule is preserved.
EOF
)"
```

---

## Task 4: Sanity-build (production build + manual smoke)

**Files:** none (verification only).

- [ ] **Step 1: Full type-check**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: 0 errors.

- [ ] **Step 2: Run the existing test suite as a regression gate**

Run: `npx ng test --watch=false`
Expected: 71/73 pre-existing tests pass (same count as before this session, since no new tests are authored per the standing user instruction).

- [ ] **Step 3: Production build**

Run: `npx ng build --configuration development`
Expected: build succeeds. The pre-existing Sass `@import` deprecation warnings are expected; no new errors.

- [ ] **Step 4: Commit (no-op if already clean)**

```bash
git status --short
```
If the output is empty, nothing to commit — the previous task commits are the final state. If anything is dirty, commit it.

---

## Self-Review Notes

**Spec coverage:**

| Spec section | Plan task |
|---|---|
| §5.1 input → textarea with auto-grow | Task 3 (Steps 1, 2, 3, 4) |
| §5.2 mobile chat-style alignment + bubble max-width 75% | Task 2 (Step 2) |
| §5.2 hide reply on mobile, keep copy at 32×32 | Task 2 (Step 2 — `.action-reply { display: none }` + `.action-btn { width: 32px }`) |
| §5.3 SwipeableBubbleComponent + 60px threshold + vertical-priority | Task 1 (full implementation) |
| §5.3 wrap each `.message` in `<app-swipeable-bubble>` in `comment-list.ts` | Task 2 (Step 1) |
| §5.4 comments-panel.ts unchanged | (No task — explicitly out of scope.) |
| §6 reduced-motion handling | Task 1 (CSS), Task 2 (none — swipe gesture is the only motion, covered in Task 1) |
| §6 dark mode | No new color values; existing `:host-context(.dark)` rules apply. (No task — already covered.) |
| §6 iOS Safari auto-zoom (16px) | Task 3 (Step 3) |
| §7 manual verification checklist | Task 4 (Steps 1-3 + browser pass by implementer if user requests) |

**Placeholder scan:** No `TBD`/`TODO`/`FIXME` markers; every step has complete, runnable code.

**Type consistency:** `SwipeableBubbleComponent`'s `commentId` (string, matching `Comment._id`) and `reply` output (`output<string>()`, since the bubble emits the id — matches the existing `comment-list.ts` `onReply(comment)` argument shape) are consistent throughout Tasks 1, 2, 3.

**Test-skip note:** Per user standing instruction, no `.spec.ts` files are authored. Task 4 Step 2 runs the pre-existing test suite as a regression check; timer- and IME-dependent behavior is covered by the manual verification checklist (which the user can opt into at Task 4 Step 4).