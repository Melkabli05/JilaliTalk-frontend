# Comments Feature Mobile Responsiveness Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 12 mobile-responsiveness defects in `/features/room/comments/` plus add the `visualViewport`-aware keyboard handling so the pinned input bar lifts above the iOS/Android keyboard.

**Architecture:** A new root-provided `KeyboardInsetService` listens to `window.visualViewport.resize` and exposes `keyboardInsetPx` + `isKeyboardOpen` signals. The pinned comment-input bar consumes those signals and applies a host-binding offset. The remaining 10 issues are CSS/container-query fixes plus one `aria-live` decoupling — all confined to the four comments files plus the existing `--mobile-input-height` token.

**Tech Stack:** Angular 22, zoneless + signals, OnPush, container queries. Existing `eslint-plugin-boundaries` rule and Angular's strict build enforce correctness.

---

## Global Constraints

These rules apply to every task. Copy them verbatim from the project's `CLAUDE.md` and tokens.

- **No new unit-test files** — `feedback_no-unit-tests-unless-asked.md` from user memory.
- **No upward/sideways imports** — `features/` → `core/` is allowed (per existing usage in `event-feed-store.ts:5-6`). Use the `@core/*` alias.
- **Components stay OnPush; no `standalone: true`** — `CLAUDE.md §10`.
- **Use design tokens; never hardcode colors / magic numbers** — `CLAUDE.md §16`. The reservation value already moved to `var(--mobile-input-height)` per the same review.
- **All mobile-only CSS in `@container room-page (...)` rules** — replaces the buggy `@container comments-panel` per the design doc. `room-page` already declares `container-type: size; container-name: room-page;` in `pages/room-page/room-page.scss:6`.
- **Wider container-query breakpoint with height gate** — `(max-width: 1023.98px) and (min-height: 500px)`. The `min-height: 500px` clause excludes landscape phones that fall back to mobile layout, matching the existing room-page fallback at `room-page.scss:63`.
- **Touch targets**: WCAG 2.5.5 AAA primary interactive controls ≥ 44×44. Hit area can exceed visual size via `min-width/min-height`.
- **Verified commands**: `npm run build` and `npm test` must pass. `npm run lint:styles` is the only available stylelint script.

---

## File Structure

### New files

- `src/app/core/services/keyboard-inset.service.ts` — `@Injectable({ providedIn: 'root' })`. Owns `window.visualViewport.resize` and `.scroll` listeners; exposes `keyboardInsetPx: Signal<number>` and `isKeyboardOpen: Signal<boolean>`. SSR-safe via `isPlatformBrowser`.

### Modified files

- `src/styles/tokens.scss` — confirm `--mobile-input-height: 64px` (no change needed; token already exists per `tokens.scss:181`). Verification step only.
- `src/app/features/room/comments/comment-input.ts` — inject service, add host-binding for offset, raise button sizes on mobile, fix emoji picker height.
- `src/app/features/room/comments/comment-list.ts` — switch container queries to `@container room-page (...)`, raise tap targets, center empty-state, drop `aria-live`.
- `src/app/features/room/comments/comments-panel.ts` — switch container queries, replace literal `60px` with token, add hidden aria-live region.
- `src/app/features/room/comments/caption-list.ts` — drop `aria-live`, center empty-state.

No other files touched.

---

## Task 1: KeyboardInsetService (new core service)

**Files:**
- Create: `src/app/core/services/keyboard-inset.service.ts`

**Interfaces:**
- Produces:
  - `keyboardInsetPx: Signal<number>` — bottom inset caused by the open soft keyboard, in CSS pixels. `0` when the keyboard is closed.
  - `isKeyboardOpen: Signal<boolean>` — true iff `keyboardInsetPx() > 0`.
  - Constructor injects `PLATFORM_ID`, `DestroyRef`.

- Consumes: `window.visualViewport` (browser only). Falls back to a no-op signal that always returns `0` on the server.

**Reference pattern (copy style from `core/services/theme.service.ts` and `core/services/pwa-update.service.ts`):**

- `import { Injectable, PLATFORM_ID, DestroyRef, inject, signal, computed } from '@angular/core';`
- `import { isPlatformBrowser } from '@angular/common';`
- Use `@Injectable({ providedIn: 'root' })` (the project mixes `@Injectable` and `@Service` mid-migration; for a root scope, either works; `@Injectable` matches `pwa-update.service.ts` which is the closer architectural template because it adds a window listener on construction).

### Steps

- [ ] **Step 1: Write the service skeleton**

Create `src/app/core/services/keyboard-inset.service.ts`:

```ts
import { Injectable, PLATFORM_ID, DestroyRef, inject, signal, computed } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Tracks the soft-keyboard inset via the `visualViewport` API so pinned
 * bottom-of-viewport UI (the comment-input bar is the primary consumer) can
 * lift itself above the keyboard on iOS and Android.
 *
 * Browser-only: on the server, both signals return their zero values and the
 * listener is never registered. The platform check happens once at construct.
 *
 * Why a singleton: any two listeners on `visualViewport.resize` would both
 * measure and re-set state — duplicate work and a race. Root-provided so any
 * component can `inject(KeyboardInsetService)` without prop-drilling.
 */
@Injectable({ providedIn: 'root' })
export class KeyboardInsetService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _keyboardInsetPx = signal(0);
  /** Pixels of bottom inset caused by an open soft keyboard. Zero when closed. */
  readonly keyboardInsetPx = this._keyboardInsetPx.asReadonly();

  /** True when the soft keyboard is currently visible. */
  readonly isKeyboardOpen = computed(() => this._keyboardInsetPx() > 0);

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;
    if (typeof window === 'undefined' || !('visualViewport' in window)) return;

    const recompute = () => {
      const vv = window.visualViewport;
      // The keyboard inset is the layout-viewport (window.innerHeight) minus
      // the visual-viewport (what's actually visible after the keyboard pushes
      // the layout viewport up). On desktop, the two are equal, so the inset
      // is 0. iOS Safari reports a positive value when the keyboard is open
      // even though `window.innerHeight` doesn't shrink.
      const inset = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
      this._keyboardInsetPx.set(inset);
    };

    window.visualViewport.addEventListener('resize', recompute);
    window.visualViewport.addEventListener('scroll', recompute);
    recompute();

    this.destroyRef.onDestroy(() => {
      window.visualViewport?.removeEventListener('resize', recompute);
      window.visualViewport?.removeEventListener('scroll', recompute);
    });
  }
}
```

- [ ] **Step 2: Verify build**

Run from `JilaliTalk-angular-frontend/`:

```bash
npm run build
```

Expected: build succeeds with no TypeScript errors. The new service compiles in isolation.

- [ ] **Step 3: Commit**

```bash
git add src/app/core/services/keyboard-inset.service.ts
git commit -m "feat(core): add KeyboardInsetService for soft-keyboard awareness"
```

---

## Task 2: Comment-input uses KeyboardInsetService

**Files:**
- Modify: `src/app/features/room/comments/comment-input.ts`

**Interfaces:**
- Consumes: `KeyboardInsetService.keyboardInsetPx()` (signal).
- Produces:
  - Host element gets `style.bottom.px` lifted by `keyboardInsetPx()` so the keyboard pushes the bar up.
  - Wrapper `padding-bottom` grows so its inner content stays above the safe-area + keyboard.
  - Emoji picker max-height caps at the visible viewport (i.e. excludes `keyboardInsetPx()`).

### Steps

- [ ] **Step 1: Add imports + inject the service**

Edit `src/app/features/room/comments/comment-input.ts`. Replace the existing import line 1:

```ts
import { Component, ChangeDetectionStrategy, computed, input, output, signal, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
```

Add the new import near the existing `@angular/cdk` block:

```ts
import { KeyboardInsetService } from '@core/services/keyboard-inset.service';
```

Inside the class body (anywhere above the constructor), inject:

```ts
private readonly keyboardInset = inject(KeyboardInsetService);
```

- [ ] **Step 2: Add a host-binding that lifts the pinned bar**

Inside the component class, add:

```ts
/**
 * Host-bottom offset that lifts the bar above an open soft keyboard. The bar
 * is `position: fixed; bottom: 0` inside the mobile media query; setting
 * `style.bottom.px` to the keyboard inset shifts the bar up so its bottom edge
 * sits at the top of the keyboard instead of being covered by it. iOS Safari
 * reports `window.visualViewport.height + offsetTop` shrinking while the
 * keyboard is open; this binding consumes that signal.
 */
protected readonly hostBottomPx = computed(() => this.keyboardInset.keyboardInsetPx());
```

Add a host binding to the `@Component` decorator's `host: {}` field:

```ts
host: {
  '[style.bottom.px]': 'hostBottomPx()',
},
```

(If the existing component has no `host:` key, add one above `template:`.)

- [ ] **Step 3: Fix the emoji-picker height to never exceed the visible viewport**

Inside the `@media (max-width: 1023.98px)` block (around line 202-213 of `comment-input.ts`), change the max-height to consume the keyboard inset. Replace:

```ts
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
```

with:

```ts
.emoji-picker-container {
  left: var(--space-2);
  right: var(--space-2);
  /* Cap by whichever is smaller: the library's nominal cap (400px) or the
     space actually visible above the keyboard (visible viewport minus the
     pinned input-bar height). Without the visible-viewport cap, a picker
     400px tall extends above the visible area when the keyboard is open and
     no overflow handling can save it. */
  max-height: min(
    400px,
    calc(100svh - var(--mobile-input-height) - var(--kb-inset, 0px) - 56px)
  );
  overflow-y: auto;
}

emoji-picker {
  --num-columns: 6;
  width: 100% !important;
  height: 100% !important;
  max-height: min(
    400px,
    calc(100svh - var(--mobile-input-height) - var(--kb-inset, 0px) - 56px)
  ) !important;
}
```

The `var(--kb-inset, 0px)` reads a CSS custom property that the host binding sets in the next step. Adding `overflow-y: auto` makes any overflow scrollable rather than clipped.

- [ ] **Step 4: Set `--kb-inset` from the host**

In the class body, add another host binding inside the same `host: {}`:

```ts
host: {
  '[style.bottom.px]': 'hostBottomPx()',
  '[style.--kb-inset.px]': 'hostBottomPx()',
},
```

The CSS already has `var(--kb-inset, 0px)` so the picker is correctly sized whether the keyboard is open or not.

- [ ] **Step 5: Raise reply-cancel to 44×44**

Inside the existing `@media (max-width: 1023.98px)` block (around line 188-191), replace:

```css
.reply-cancel {
  width: 32px;
  height: 32px;
}
```

with:

```css
.reply-cancel {
  width: 44px;
  height: 44px;
}
```

(This was 18×18 on desktop at line 117-122 — leave that alone; desktop doesn't need 44pt target size.)

- [ ] **Step 6: Verify the wiring**

Run:

```bash
npm run build
```

Expected: build succeeds. TypeScript recognizes `KeyboardInsetService` and the `hostBottomPx` signal.

- [ ] **Step 7: Commit**

```bash
git add src/app/features/room/comments/comment-input.ts
git commit -m "feat(comments): lift pinned input above soft keyboard, fix emoji picker height, raise reply-cancel to 44x44"
```

---

## Task 3: Comment-list container-query fix + tap targets + empty-state + aria-live

**Files:**
- Modify: `src/app/features/room/comments/comment-list.ts`

**Interfaces:**
- Consumes: existing container queries in `:host` (the `NewMessagesPillComponent` inline styles at lines 73-126).
- Produces: every `@container comments-panel (max-width: 1023.98px)` rule in the file is replaced with `@container room-page (max-width: 1023.98px) and (min-height: 500px)`. The pill height, action-btn size, and reply-quote min-height get mobile overrides. The empty-state gets `flex: 1` to center it.

### Steps

- [ ] **Step 1: Switch the pill's container query**

In `comment-list.ts`, the inline `NewMessagesPillComponent` styles block (around lines 73-126) has:

```ts
@container comments-panel (max-width: 1023.98px) {
  :host {
    bottom: calc(var(--space-3) + env(safe-area-inset-bottom, 0px));
  }
}
```

Replace with:

```ts
@container room-page (max-width: 1023.98px) and (min-height: 500px) {
  :host {
    bottom: calc(var(--space-3) + env(safe-area-inset-bottom, 0px));
  }
}
```

- [ ] **Step 2: Add tap-target mobile overrides**

Inside the `CommentListComponent` styles (the second template block, ~line 315 onward), find the `.action-btn` rule (around line 644-655) and append after it (still inside the same styles array literal, before the closing backtick):

```css
@container room-page (max-width: 1023.98px) and (min-height: 500px) {
  /* WCAG 2.5.5 AAA — primary interactive controls must hit 44×44. The
     visual size stays compact so the layout doesn't reflow; the hit area
     grows outward without changing the rendered icon. */
  .action-btn {
    min-width: 44px;
    min-height: 44px;
  }

  /* The "X new messages ↓" pill is the user's only backlog signal while
     scrolled up; under-sized touch targets miss-thumb into adjacent
     comments. Same hit-area growth trick. */
  .new-messages-pill {
    min-height: 44px;
  }

  /* Jump-to-original quote — short quoted messages ("ok", "yes") render
     smaller than the AAA target. Set a min-height so even a one-word quote
     is reachable. */
  .reply-quote {
    min-height: 44px;
  }
}
```

- [ ] **Step 3: Center the empty-state**

In the same `CommentListComponent` styles, find `.empty-state` (around line 666-673). Replace:

```css
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-6) var(--space-4);
  text-align: center;
}
```

with:

```css
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  /* `flex: 1` makes the empty-state consume the remaining column height so
     `justify-content: center` actually centers vertically. Without it,
     the empty-state is a regular flex-column item with intrinsic height
     and sits at the top of the column. */
  flex: 1;
  padding: var(--space-6) var(--space-4);
  text-align: center;
}
```

- [ ] **Step 4: Drop `aria-live="polite"` from the scroll container**

Find the template line (line 153):

```html
<div class="comment-list" role="log" aria-live="polite" aria-label="Comments" #scrollContainer>
```

Replace with:

```html
<div class="comment-list" role="log" aria-label="Comments" #scrollContainer>
```

(`role="log"` retains the semantic that this is a chronological log; the polite live-region announcements move to `comments-panel.ts` per the design doc.)

- [ ] **Step 5: Verify the build**

```bash
npm run build
```

Expected: build passes. Container queries resolve at parse time against the named `room-page` ancestor.

- [ ] **Step 6: Commit**

```bash
git add src/app/features/room/comments/comment-list.ts
git commit -m "fix(comments): resolve container queries against room-page, raise tap targets to AAA, center empty-state, drop aria-live spam"
```

---

## Task 4: Comments-panel container-query fix + token wiring + hidden live region

**Files:**
- Modify: `src/app/features/room/comments/comments-panel.ts`

**Interfaces:**
- Consumes: same `@container room-page (...)` patterns as Task 3.
- Produces:
  - Switches the two `@container comments-panel` blocks to `@container room-page`.
  - Replaces literal `60px` at line 273 with `var(--mobile-input-height)`.
  - Adds a hidden `aria-live="polite"` region announcing unread-count transitions.

### Steps

- [ ] **Step 1: Switch the expand-button and bottom-padding container query**

Find the `@container comments-panel (max-width: 1023.98px)` block around lines 264-275 in `comments-panel.ts`. Replace:

```css
@container comments-panel (max-width: 1023.98px) {
  .expand-btn { display: flex; }
  .comments-scroll {
    padding-bottom: calc(60px + env(safe-area-inset-bottom, 0px));
  }
}
```

with:

```css
@container room-page (max-width: 1023.98px) and (min-height: 500px) {
  .expand-btn { display: flex; }
  .comments-scroll {
    /* The pinned input bar's height when a reply-preview is NOT mounted;
     callers in this file and comment-list.ts reserve space matching it.
     `var(--mobile-input-height)` lives in styles/tokens.scss. */
    padding-bottom: calc(var(--mobile-input-height) + env(safe-area-inset-bottom, 0px));
  }
}
```

- [ ] **Step 2: Switch the desktop sidebar border rule**

Find the `@container comments-panel (min-width: 1024px)` block around lines 278-283. Replace:

```css
@container comments-panel (min-width: 1024px) {
  .comments-panel {
    border-top: none;
    border-left: 1px solid var(--cp-border);
  }
}
```

with:

```css
@container room-page (min-width: 1024px) and (min-height: 500px) {
  .comments-panel {
    border-top: none;
    border-left: 1px solid var(--cp-border);
  }
}
```

(The container is now the outer `room-page` whose width tracks the viewport, so this rule fires on the desktop two-column layout instead of never.)

- [ ] **Step 3: Add a hidden polite live region for unread-count transitions**

Find the `<aside class="comments-section">` closing block in the template (toward the bottom of the `<ng-template ngTabContent>` for comments tab, after the `app-comment-input`). The exact structure is around line 110-117 of `comments-panel.ts`. After the existing `app-comment-input` element (still inside the comments `ngTabContent`), add:

```html
<div class="sr-only" aria-live="polite" aria-atomic="true">
  {{ unreadAnnouncement() }}
</div>
```

Inside the class body, add the computed signal:

```ts
/**
 * SR-only announcement for unread-count transitions. Reads the store's
 * unread count and only emits a new label when the count crosses zero or
 * a new message arrives — TalkBack/VoiceOver hear "5 new messages" once
 * per transition instead of every individual comment text.
 */
private readonly prevUnread = signal(0);
protected readonly unreadAnnouncement = computed(() => {
  const count = this.commentsStore.unreadCount();
  const prev = this.prevUnread();
  if (count === prev) return '';
  this.prevUnread.set(count);
  if (count === 0) return 'No new messages';
  if (count === 1) return '1 new message';
  return `${count} new messages`;
});
```

(`sr-only` is a standard utility — define it in the component's styles array if not already globally available.)

Append to the styles array literal:

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

- [ ] **Step 4: Verify the build**

```bash
npm run build
```

Expected: build passes. The new computed signal compiles; the hidden region is a regular HTML element.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/room/comments/comments-panel.ts
git commit -m "fix(comments): resolve panel container queries to room-page, use mobile-input-height token, add SR-only live region"
```

---

## Task 5: Comment-list bottom-padding uses token + reservation accounts for reply-preview

**Files:**
- Modify: `src/app/features/room/comments/comment-list.ts`

**Interfaces:**
- Consumes: `var(--mobile-input-height)` from `styles/tokens.scss:181`.
- Produces: the `.comment-list` element's `padding-bottom` becomes a CSS expression that reserves space for the bar in both states (no reply-preview mounted, vs reply-preview mounted). The expression uses `var(--mobile-input-height)` plus a slot for the optional `.reply-preview` height.

### Steps

- [ ] **Step 1: Replace the literal `64px` with the token + slot**

In `comment-list.ts`, find line 406:

```css
padding-bottom: calc(64px + var(--space-3) + env(safe-area-inset-bottom, 0px));
```

Replace with:

```css
/* Reserve space for the pinned comment-input bar. The bar's minimum
   height is --mobile-input-height; when a `.reply-preview` is mounted
   (inside comment-input.ts), the bar grows by ~28px — `var(--space-4)`
   is ~24px which covers it. Safe-area inset is the iOS home-indicator. */
padding-bottom: calc(
  var(--mobile-input-height) +
  var(--space-4) +
  env(safe-area-inset-bottom, 0px)
);
```

(Verify `var(--space-4)` is ~24px in `styles/tokens.scss`; if not, adjust.)

- [ ] **Step 2: Verify the build**

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/room/comments/comment-list.ts
git commit -m "fix(comments): list bottom-padding uses --mobile-input-height token with reply-preview slot"
```

---

## Task 6: Caption-list empty-state centering + drop aria-live

**Files:**
- Modify: `src/app/features/room/comments/caption-list.ts`

### Steps

- [ ] **Step 1: Center empty-state**

Find `.empty-state` (around line 125-128). Replace:

```css
.empty-state {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: var(--space-6) var(--space-4); text-align: center;
}
```

with:

```css
.empty-state {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center;
  /* `flex: 1` lets the empty-state fill remaining column height so
     `justify-content: center` actually centers it vertically. */
  flex: 1;
  padding: var(--space-6) var(--space-4); text-align: center;
}
```

- [ ] **Step 2: Drop `aria-live="polite"`**

Find the template (line 14):

```html
<div class="caption-list" role="log" aria-live="polite" aria-label="Captions">
```

Replace with:

```html
<div class="caption-list" role="log" aria-label="Captions">
```

- [ ] **Step 3: Verify the build**

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 4: Commit**

```bash
git add src/app/features/room/comments/caption-list.ts
git commit -m "fix(captions): center empty-state, drop aria-live spam (matches comment-list)"
```

---

## Task 7: End-to-end verification

**Files:** none modified in this task.

### Steps

- [ ] **Step 1: Run the full test suite**

```bash
npm test -- --run
```

Expected: all existing tests pass (including `room-header.spec.ts`, `toast.service.spec.ts`, etc.). The new code introduces no new test files per the user's no-new-tests directive.

- [ ] **Step 2: Run the build**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Run the style linter**

```bash
npm run lint:styles
```

Expected: no new style errors.

- [ ] **Step 4: Manual smoke (mobile viewport)**

Open the room page in a Chromium browser at a 360×640 viewport with the device emulation "iPhone SE" preset in DevTools. Verify visually:

1. On a fresh room, the empty-state icon is centered vertically in the comments pane (not pinned to the top).
2. Reply-preview does not make the bar overlap the last comment.
3. The "X new messages ↓" pill is at least 44px tall.
4. Reply-quote jump-to-original is reachable (≥44px tall).
5. Open emoji picker, then tap the input to open the iOS keyboard — emoji picker does not overflow the visible viewport at the top.
6. The bar lifts above the keyboard; the input remains visible and tappable while typing.

(These checks are manual — the implementer has no automated visual checks. If a check fails, fix the relevant rule per the task that owns it.)

- [ ] **Step 5: Manual smoke (desktop viewport)**

Open at 1600×1000. Verify:

1. The comments sidebar's expand button (the icon next to "Refresh") is NOT shown.
2. No phantom 60px padding at the bottom of the sidebar.
3. The pill bottom offset has no spurious safe-area.

- [ ] **Step 6: Commit (if any fix-up changes were needed)**

If anything was changed during the manual smoke, commit it with the appropriate `fix(comments):` prefix. If clean, skip this step.

---

## Self-Review

**Spec coverage:**

- Keyboard handling — Task 1 + Task 2 ✓
- Container-query fix — Task 3 (comment-list) + Task 4 (comments-panel) ✓
- Token wiring for `--mobile-input-height` — Task 4 + Task 5 ✓
- Touch-target size — Task 2 (reply-cancel) + Task 3 (action-btn, pill, reply-quote) ✓
- Empty-state centering — Task 3 + Task 6 ✓
- aria-live decoupling — Task 3 + Task 4 + Task 6 ✓
- Emoji-picker viewport overflow — Task 2 ✓
- Replying-with-preview overlap — Task 5 ✓
- Dead `@container (min-width: 1024px)` rule — fixed in Task 4 ✓
- `.time` margin-left-auto wrap behavior — left as-is per spec; cosmetic only ✓
- Token drift — Task 4 + Task 5 fix this ✓

**Placeholder scan:** none. All code blocks are complete.

**Type consistency:**

- `KeyboardInsetService.keyboardInsetPx` — declared as `Signal<number>` in Task 1, consumed as `keyboardInset.keyboardInsetPx()` (signal call) in Task 2. ✓
- `hostBottomPx` computed — declared in Task 2 step 2 as `protected readonly`, consumed by host binding on the same component. ✓
- `commentsStore.unreadCount` — already exists on `COMMENTS_READER` token (`comments-store.ts:21`). The Task 4 step 3 access matches the existing surface. ✓
- `var(--mobile-input-height)` token — already declared at `tokens.scss:181`. Tasks 4 and 5 consume it. ✓
- `var(--kb-inset)` — set as a host style binding in Task 2 step 4, consumed by the picker in Task 2 step 3. ✓

No type or signature mismatches found.

---

Plan complete and saved to `docs/superpowers/plans/2026-07-07-comments-mobile-fixes.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task with two-stage review between tasks.
2. **Inline Execution** — I execute tasks in this session with checkpoints.

Which approach?
