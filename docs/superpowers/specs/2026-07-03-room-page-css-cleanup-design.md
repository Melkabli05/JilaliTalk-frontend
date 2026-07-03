# Room Page CSS Cleanup — Dead Rules + Safe-Area Floor

**Date:** 2026-07-03
**Scope:** `features/room/pages/room-page.ts` only. Follow-up to
`2026-07-03-room-page-mobile-first-redesign-design.md`, addressing two remaining items
from the original redesign brief ("remove redundant/conflicting styles", "improve safe-area
support") that fell out of that pass's scope.

## 1. Remove dead `max-height: none` rules

`.room-layout`'s desktop `@container` block currently resets:

```css
.stage-section { max-height: none; }
.comments-section { max-height: none; }
```

Neither class has a `max-height` property set anywhere in the current grid architecture —
sizing comes entirely from `.room-layout`'s `grid-template-rows` tracks (`minmax(0, 30cqh)`
etc.), not from `max-height` on the items themselves. These two lines are inert leftovers
from the pre-flattening flex-based version, where `.stage-section`/`.comments-section` did
carry their own `max-height`. Delete both lines; no behavior change.

## 2. Safe-area floor on mobile

`:host`'s mobile padding is exactly `env(safe-area-inset-top/bottom)`, which resolves to
`0` on any non-notched device (most Android phones, older iPhones) — in immersive mode
(global header/bottom-nav hidden), room content on those devices touches the screen edges
with zero margin. Add a guaranteed minimum via `max()`, using the existing `--space-1`
(4px) token rather than a new magic number:

```css
:host {
  padding-top: max(env(safe-area-inset-top), var(--space-1));
  padding-bottom: max(env(safe-area-inset-bottom), var(--space-1));
}
```

On notched devices this is a no-op (the real inset already exceeds 4px). On non-notched
devices it adds a small, consistent breathing margin. The desktop `@media (min-width: 1024px)`
override (`padding-top: var(--app-header-height); padding-bottom: 0;`) is untouched.

## 3. Explicitly out of scope

- No new `gap` between grid areas — current zero-gap visual rhythm is an intentional,
  previously-confirmed design decision, not a defect.
- No other file changes — `stage-grid.ts`, `audience-list.ts`, `comments-panel.ts`,
  `room-header.ts`, `video-room-page.ts` untouched.
- No logical-property conversion — `room-page.ts` has no physical (`left`/`right`-style)
  directional properties to convert; the file is already direction-neutral.

## 4. Verification

- `ng build` — confirms no syntax errors.
- `npm run lint:styles` — no new violations.
- Visual check: room page on a non-notched mobile viewport now shows a small top/bottom
  margin instead of edge-to-edge content; desktop layout is pixel-identical to before.
