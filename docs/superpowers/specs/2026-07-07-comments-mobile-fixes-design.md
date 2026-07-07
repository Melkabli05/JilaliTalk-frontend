# Comments feature — mobile responsiveness fixes

Status: draft. Date: 2026-07-07. Owner: feature/room/comments.

## Context

A code review of `/features/room/comments/` (`comments-panel.ts`, `comment-list.ts`,
`comment-input.ts`, `caption-list.ts`) identified 12 mobile-responsiveness defects
spanning: container-query mis-classification on the desktop sidebar, sub-WCAG tap targets,
iOS keyboard overlap on the pinned input, uncentered empty-state, and a few latent issues
(unused mobile-input-height token, dead `@container (min-width: 1024px)` rule,
spammy `aria-live`, emoji-picker viewport overflow).

This spec covers fixes for all 12 in one pass. The goal is to make the comments panel
work correctly on a 320–480px-wide phone with a soft keyboard, while not regressing the
desktop sidebar layout (and not breaking landscape phones that fall back to mobile layout).

## Non-goals

- No new unit tests (per user feedback memory `feedback_no-unit-tests-unless-asked.md`).
- No changes outside the comments feature except the new shared `keyboard-inset.service`.
- No visual redesign. Spacing, colors, tokens — all reused as-is.

## Decisions

1. **Scope**: fix all 12 issues, including the iOS keyboard overlap.
2. **Keyboard handling**: a singleton service at `core/services/keyboard-inset.service.ts`
   listens to `window.visualViewport.resize` and exposes `keyboardInsetPx` as a signal.
   The input bar consumes the signal via a computed offset. Cross-platform: iOS Safari
   13.1+, Android Chrome 108+, desktop (no-op when `visualViewport === window`).
3. **Container-query fix**: switch the buggy
   `@container comments-panel (max-width: 1023.98px)` rules at
   `comments-panel.ts:264-275`, `comments-panel.ts:278-283`, and `comment-list.ts:85-89`
   to `@container room-page (...)`. `room-page` already declares
   `container-type: size; container-name: room-page;` (`pages/room-page/room-page.scss:6`).
   The same pattern is already used by `stage/stage-grid.ts:107` and `ui/stage-user.ts:141`
   so the resolution path is proven. Container queries search by name, so the inner
   `comments-panel` host (named `comments-panel`) does not shadow `room-page`.
4. **`aria-live`**: remove `aria-live="polite"` from the scroll container in
   `comment-list.ts:153` and `caption-list.ts:14`. Keep `role="log"` for the implicit
   AT semantics. Add a hidden `aria-live="polite"` region in `comments-panel.ts` that
   announces only count changes ("5 new messages") on transitions, not every message.
   The pill already exists and is the user's primary signal — the live region mirrors it.

## Concrete changes by file

### `src/app/core/services/keyboard-inset.service.ts` (new)

Singleton service, root-provided. Listens to `window.visualViewport.resize` and
`window.visualViewport.scroll`, debounced via `requestAnimationFrame`, exposing:

```ts
readonly keyboardInsetPx: Signal<number>; // bottom inset caused by open keyboard, 0 when closed
readonly isKeyboardOpen: Signal<boolean>;
```

Reads `window.visualViewport.height` and the difference vs `window.innerHeight`.
SSR-safe (guards `typeof window !== 'undefined'` and `'visualViewport' in window`).
On a root-provided `@Service()` so any component can inject it.
Lifecycle: registers listeners at first inject, cleans up on `DestroyRef` if injected
in a non-root context (defensive — production use is root).

### `src/app/core/services/index.ts` (or appropriate barrel)

Re-export the service. (Skip if `core/services/` doesn't have an index today; import
directly via the `@core/...` alias from the consumer.)

### `src/app/features/room/comments/comment-input.ts`

- Inject `KeyboardInsetService`. Add `keyboardOffset` computed signal =
  `service.keyboardInsetPx() + env(safe-area-inset-bottom, 0px)`. In a template, the
  pinned bar's `bottom: 0` becomes `bottom: var(--kb-inset, 0px)` and `style.bottom.px`
  is set from the signal in the component class via a host-binding.
- Resize the input to keep the iOS 16px anti-zoom contract. Add `padding-bottom` to
  the wrapper that grows with keyboard inset (lift content above the keyboard).
- Cancel the keyboard when the user scrolls the list (don't keep keyboard open if the
  user starts reading other comments) — optional, NOT in scope for this spec.
- Replace literal `padding-bottom: calc(var(--space-2) + env(safe-area-inset-bottom, 0px))`
  at line 136 with the existing token pattern, but keep `safe-area` since the token
  doesn't include it.

### `src/app/features/room/comments/comment-list.ts`

- Switch `@container comments-panel (max-width: 1023.98px)` at line 85-89 to
  `@container room-page (max-width: 1023.98px) and (min-height: 500px)`. The
  `min-height: 500px` clause excludes landscape phones that are too short for the
  mobile layout (matches the existing room-page fallback condition at
  `room-page.scss:63`).
- `.action-btn` at line 644-655: increase visual size to 24×24 and add a
  `min-width/min-height: 44px` (hit area) on mobile via
  `@container room-page (max-width: 1023.98px) and (min-height: 500px)`.
- `.new-messages-pill` at line 90-104: add `min-height: 44px` inside the same
  container query.
- `.reply-quote` at line 589-635: add `min-height: 44px` inside the same container query.
- Empty-state at line 666-673: add `flex: 1;` and verify vertical centering.
  Or simpler: add `margin: auto 0` — flex-box child of a column flex parent
  (`margin: auto 0` on the child centers along main axis when the parent doesn't
  set `justify-content`).
- Remove `aria-live="polite"` at line 153 (keep `role="log"`).
- `.time { margin-left: auto }` at line 537 in a wrap row: when wrapping, the time
  drops to its own line and stays right-aligned. Accept the current behavior;
  add a comment if needed.

### `src/app/features/room/comments/comments-panel.ts`

- Switch `@container comments-panel (max-width: 1023.98px)` at line 264 (the
  `.expand-btn`, `.comments-scroll` rules) and the dead
  `@container comments-panel (min-width: 1024px)` at line 278-283 to
  `@container room-page (max-width: 1023.98px) and (min-height: 500px)`
  and `@container room-page (min-width: 1024px) and (min-height: 500px)`
  respectively.
- Drop the top border on mobile too (it already has top border by default at line 165);
  the desktop rule should still swap to left border.
- Update `padding-bottom` at line 273 to use the `var(--mobile-input-height)` token
  (see below).
- Add a hidden `<div aria-live="polite">` for the count-changes announcement,
  driven by a `computed(() => ...)` over the existing `unreadCount()` signal that
  only fires on transitions.
- Reply-cancel on mobile at `comment-input.ts:188-191` (fix in that file):
  raise to `44×44` inside the existing mobile media query.

### `src/app/features/room/comments/caption-list.ts`

- Remove `aria-live="polite"` at line 14 (keep `role="log"`).
- Apply the same empty-state centering fix at line 125-128 (add `flex: 1` or
  `margin: auto 0`).

### `src/app/features/room/comments/comment-input.ts` (mobile sizing)

- Inside `@media (max-width: 1023.98px)` (line 176), raise:
  - `.reply-cancel` from 32×32 to 44×44.
  - Already 44×44 — leave `.emoji-btn`, `.send-btn`.

### `src/app/features/room/comments/comment-input.ts` (emoji picker overflow)

- Replace the current min/max-height approach for `.emoji-picker-container` (line 202-213)
  with a `max-height: calc(100svh - var(--mobile-input-height) - <kb-inset> - <host-height>)`
  that never exceeds the visible viewport. Backing math: visible viewport =
  `100svh - keyboardInsetPx - safe-area`. The picker height becomes
  `min(400px, calc(100svh - var(--mobile-input-height) - <kb-inset>px - 24px))`.
  Add `overflow-y: auto` to make any overflow reachable.

### `src/styles/tokens.scss`

- Verify `--mobile-input-height: 64px` token (line 181) is consumed by all three
  call sites. Change the literal `64px` at `comment-list.ts:406` and the literal
  `60px` at `comments-panel.ts:273` to `var(--mobile-input-height)`.

## Token for bar height when reply-preview is mounted

The bar has TWO states (with vs without `.reply-preview`). The `.reply-preview` adds
~28px (per `comment-input.ts:104: padding: var(--space-1) var(--space-3)` plus
content). The token `--mobile-input-height: 64px` only describes the bare wrapper.

Decision: keep the single token. Document that the `--mobile-input-height` token
describes the minimum bar height; consumers should also account for ~28px when a
reply-preview may be present. **For now**: replace the reservation with a CSS
expression `calc(var(--mobile-input-height) + var(--space-4) + env(safe-area-inset-bottom, 0px))`
in both consumers, accounting for the optional reply-preview slot. Falls through to
no extra space when the preview is hidden.

## Behavior matrix (mobile / desktop / landscape phone)

| Viewport | Container width | Resolution |
|----------|----------------|------------|
| Mobile portrait (≥500h, ≤1023w) | full-width | `@container room-page (<=1023.98px) and (>=500h)` matches → mobile rules fire |
| Mobile landscape (<500h) | full-width | Same rules DON'T match → no expand button, no extra padding (matches the room-page fallback which is mobile layout anyway) |
| Desktop sidebar (viewport ≥1024 wide) | 500px | `@container room-page` is now ≥1024 → desktop rules fire (top border kept, expand button hidden) |
| Desktop narrow window (viewport exactly 1023.98) | full-width | Mobile rules match. The room-page fallback forces it. Consistent. |

## Out of scope

- Adding unit tests (per project feedback).
- Changing overall visual design (typography, spacing, colors).
- Adding an emoji-search field or other features.
- Adding a "tap-outside-keyboard" handler to dismiss the keyboard.

## Files touched

```
NEW    src/app/core/services/keyboard-inset.service.ts
EDIT   src/app/features/room/comments/comment-input.ts
EDIT   src/app/features/room/comments/comment-list.ts
EDIT   src/app/features/room/comments/comments-panel.ts
EDIT   src/app/features/room/comments/caption-list.ts
EDIT   src/styles/tokens.scss                 (only if token name needs adjustment — current name is fine)
```

## Self-review

- Placeholder scan: no TBDs.
- Internal consistency: container-query breakpoints harmonized to `(<=1023.98px) and (>=500h)`.
- Scope: bounded to one feature + one new infra service.
- Ambiguity: "min-height: 44px for tap targets" — clarify via WCAG 2.5.5 AAA in commit msg.
