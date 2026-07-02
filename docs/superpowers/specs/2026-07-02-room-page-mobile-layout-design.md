# Room Page Mobile Layout — Container-Relative Sizing & Scroll Fix

**Date:** 2026-07-02
**Scope:** `features/room/pages/room-page.ts` (voice room) only — the stretch/scroll fix is applied entirely from the parent's stylesheet via a child-element selector (`.stage-section app-stage-grid`), so `features/stage/stage-grid.ts` itself is not modified. `video-room-page.ts` and `audience-list.ts`'s internal collapse logic are explicitly out of scope (see §4).

## 1. Problem

`room-page.ts`'s mobile layout (header → stage → audience → comments, stacked below the 1024px container-query breakpoint) has two concrete bugs, both rooted in the same cause: parts of it size themselves against the raw device viewport instead of the room's actual available height.

1. **Silent stage clipping, no scroll.** `.stage-section { max-height: 32vh/38vh; overflow: hidden }` is a plain flex item — it is not itself a flex/grid container, so its child `<app-stage-grid>` (whose own `:host` declares `overflow-y: auto` but no explicit height) is never stretched to fill it and never receives a bounded box to scroll within. It just grows to its content's natural height and gets hard-clipped by the parent's `overflow: hidden`. Extra speakers beyond what fits in the capped height simply disappear, with no scrollbar and no visual indication more exist.
2. **Height caps computed against the wrong box.** `32vh`/`38vh` are relative to the full device viewport, but the room page's actual available height is already smaller than that — the app shell (`app.ts`) reserves `padding-bottom: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom))` for the fixed mobile bottom nav on every route below 1024px, and the room page is mounted inside that already-shrunk slot. A `vh`-based cap can therefore claim a disproportionately large share of the *actually available* space, squeezing `.audience-section` (which has no minimum height of its own — only `flex: 1 1 0`) on short screens.

Both bugs trace back to the same fix: measure against the room page's own resolved height, not the viewport.

## 2. Fix

**2.1 — `:host` becomes a size container, not just an inline-size container.**

```css
:host {
  container-type: size; /* was: inline-size */
  container-name: room-page;
}
```

`:host` already has a definite height (`height: 100%`, resolved from its ancestor chain, not from its own content), so switching to `size` containment is safe — no circular sizing risk. `size` containment is a strict superset of `inline-size`: every existing `@container room-page (min-width: ...)` rule keeps working unchanged, and it additionally unlocks `cqh`/`cqb` (container-query height units), which resolve against this element's own block size instead of the viewport.

**2.2 — Stage caps switch from `vh` to `cqh`, same two-tier breakpoint.**

```css
.stage-section { max-height: 30cqh; }
@container room-page (min-width: 480px) {
  .stage-section { max-height: 34cqh; }
}
```

Same shape as today (a base cap, a slightly larger one once there's a bit more width to work with), just measuring against the right box. `.comments-section`'s existing `max-height: 50%` is already relative to its actual flex parent (`.room-body`), not the viewport — it's not part of this bug and is left untouched.

**2.3 — `.stage-section` becomes a real flex container so its child can scroll.**

```css
.stage-section {
  display: flex;
  flex-direction: column;
  /* existing: flex-shrink, min-height, min-width, max-height, overflow */
}
.stage-section app-stage-grid {
  flex: 1 1 auto;
  min-height: 0;
}
```

`app-stage-grid`'s own host already declares `overflow-y: auto`; it has simply never been given a bounded height to scroll within. Stretching it via `flex: 1 1 auto` inside a `display: flex` parent gives it one. This is the same stretch-and-constrain pattern `video-stage-grid` already uses correctly elsewhere in the codebase (`.stage-section { display: grid; grid-template-rows: 1fr } .stage-section app-video-stage-grid { height: 100%; overflow: hidden }`), applied here for the first time to the voice-room stage.

**2.4 — `.audience-section` gets a guaranteed minimum height.**

```css
.audience-section { min-height: 22cqh; }
```

Today it's only `flex: 1 1 0` with no floor — if stage and comments both claim their maximum on a short screen, audience can be squeezed to near-nothing. A `cqh`-based floor guarantees it always shows a usable amount, regardless of how much the other two sections claim.

## 3. What does not change

- Section order and the overall stacked-mobile / sidebar-desktop structure (the 1024px breakpoint, the desktop grid switch) — nothing about the visual hierarchy is broken, only the responsive sizing mechanics.
- `.comments-section`'s sizing (already correctly relative).
- Any inputs/outputs or data flow — this is CSS-only.
- Desktop (≥1024px) behavior — the existing `@container room-page (min-width: 1024px)` block already sets `max-height: none` on `.stage-section` and doesn't rely on `vh` at all; it's untouched.

## 4. Explicitly out of scope (flagged, not fixed here)

- **`video-room-page.ts`** has a structurally similar but separately-scoped set of issues (mobile comments panel is `display: none` entirely, with no way to reach it) — a different page, a different fix, deliberately not bundled into this pass.
- **`audience-list.ts`** collapses its own internal grid/list view using `window.matchMedia('(max-width: 1023.98px)')` in its constructor, which is inconsistent with the rest of this component tree's container-query-driven philosophy, but it's that component's own internal concern, not `room-page.ts`'s grid, and changing it would require a `ResizeObserver`-based rewrite of a `TS`-driven signal (not just CSS) — a separate, independently-scoped task.
