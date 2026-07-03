# Room Page Mobile-First Redesign — App Shell Immersive Mode + Grid Rebuild

**Date:** 2026-07-03
**Scope:** `features/room/pages/room-page.ts` (voice room only), plus the App Shell files it
depends on for its mobile layout: `app.ts`, `core/layout/header.component.ts`,
`core/layout/sidenav.component.ts`, `features/room/room.routes.ts`.

**Explicitly out of scope** (unchanged by this work):
- `features/room/pages/video-room-page.ts` — a structurally similar but separately-scoped
  set of issues (its mobile comments panel is `display: none` with no way to reach it).
  Not touched here; a future pass can extend this same grid/shell pattern to it.
- `features/room/feature/audience/audience-list.ts`'s internal `window.matchMedia`-driven
  collapse logic — inconsistent with the container-query philosophy used everywhere else
  in this tree, but it's that component's own internal concern, shared with the (out of
  scope) video room page, and changing it is a separately-scoped task.
- `features/room/feature/room-header/room-header.ts` — has an in-progress, uncommitted
  change (a toolbar separator + padding tweak) that is left as-is. This redesign treats
  `room-header` as a fixed-height grid slot and does not modify its internals.
- Any global fix to the app-wide header/content offset gap (see §3) beyond the Room Page's
  own slot — that gap affects every route, not just this one, and a blanket fix is a
  separate, app-wide task.

## 1. Problem

Two independent problems compound on the Room Page's mobile layout:

1. **Redundant, space-hungry chrome.** On narrow viewports, the global app shell
   (`app.ts`) always renders the fixed 56px `app-header` (logo, notifications, coins,
   login/create-room, theme toggle) above the room, and the fixed 64px mobile bottom nav
   below it — on top of the room's *own* `room-header` (mic/cam controls, leave button).
   Two headers stacked, plus a bottom nav, leaves a badly squeezed middle band for the
   actual room content (stage, audience, comments) on a phone screen.
2. **Layout mechanics inherited unnecessary nesting.** `room-page.ts`'s template nests
   three layout boxes to produce one visual result: a 1-row CSS Grid (`.room-layout`)
   wrapping a flex column (`.room-body`) wrapping another flex column (`.left-column`,
   holding header/stage/audience) plus a sibling `.comments-section`. The sizing numbers
   themselves were already fixed correctly in the prior pass (`2026-07-02-room-page-mobile-layout-design.md`
   — container-relative `cqh` caps, proper flex-stretch for scroll); what's left is
   structural: this can be one flat CSS Grid instead of three nested boxes.

A third, smaller finding: there is no `padding-top` anywhere in the app reserving space
for the fixed `app-header`, on any route (verified by exhaustive grep across `src/`) — so
every page's content technically starts underneath the translucent, blurred header rather
than below it. This is a pre-existing, app-wide condition, not something introduced by or
unique to the Room Page, and a blanket fix is out of scope here. This spec fixes it only
for the Room Page's own slot (§3.3), so the Room Page itself is correct regardless of
whether the broader app-wide gap is ever addressed separately.

## 2. App Shell: immersive mode for room routes

**2.1 — Route data flag.** Only the voice room route in `room.routes.ts` gains
`data: { immersive: true }`:

```ts
{
  path: ':cname/:busiType',
  title: 'Room',
  data: { immersive: true },
  loadComponent: () => import('./pages/room-page').then((m) => m.RoomPageComponent),
},
```

The `video/:cname/:busiType` route is deliberately **not** touched — `video-room-page.ts`
is out of scope for this pass (see scope note above), and flipping its mobile chrome
without also fixing its known mobile comments gap would change its behavior without
fixing the thing that behavior change would be in service of. A future pass extending
this pattern to the video room should add the flag there alongside that work.

**2.2 — Signal in `app.ts`.** `App` injects `Router`, subscribes to `router.events`
filtered to `NavigationEnd`, walks `router.routerState.snapshot.root` via `.firstChild`
to the leaf, and reads `.data['immersive'] === true`, converted to a signal via
`toSignal(..., { initialValue: false })` — the same `toSignal` import that already exists
in `app.ts` today (currently unused). No new service, no `core` → `feature` import: this
is route metadata, read the same way `title` already is.

**2.3 — CSS toggles via `:host-context`, not structural `@if`.** `App`'s template adds
`[class.immersive]="immersive()"` to `.app-shell`. `HeaderComponent` and `SidenavComponent`
are **not** conditionally unmounted (they hold live state — the header's online/offline
listeners, notification polling) — instead, each adds a `:host-context(.app-shell.immersive)`
rule, mirroring the existing `:host-context(.dark)` dark-mode pattern already used
throughout this codebase:

```css
/* header.component.ts */
@media (max-width: 1023.98px) {
  :host-context(.app-shell.immersive) .app-header { display: none; }
}
```
```css
/* sidenav.component.ts */
@media (max-width: 1023.98px) {
  :host-context(.app-shell.immersive) .mobile-nav { display: none; }
}
```

Desktop (`.sidebar-desktop`, and the app-header at ≥1024px) is untouched by both rules —
immersive mode only hides chrome below the 1024px breakpoint.

**2.4 — `.app-main` padding-bottom becomes conditional.** Today it unconditionally
reserves `calc(var(--bottom-nav-height) + env(safe-area-inset-bottom))` below 1024px.
Add:

```css
@media (max-width: 1023.98px) {
  .app-shell.immersive .app-main { padding-bottom: env(safe-area-inset-bottom); }
}
```

**Net effect:** on a phone, navigating into a room hides the global header and bottom nav;
the room's own `room-header` is the only top chrome. Desktop is unaffected — sidebar and
app-header render exactly as they do today, on every route including rooms.

## 3. Room Page: single CSS Grid, named areas

**3.1 — Flatten the template.** `.room-body` and `.left-column` wrapper `<div>`s are
removed. `room-header`, `.stage-section`, `.audience-section`, and `.comments-section`
become direct children of `.room-layout`, each assigned a named grid area:

```html
<div class="room-layout">
  <div class="room-header"> <app-room-header ... /> </div>
  <section class="stage-section"> <app-stage-grid ... /> </section>
  <section class="audience-section"> <app-audience-list ... /> </section>
  <aside class="comments-section"> <app-comments-panel ... /> </aside>
</div>
```

**3.2 — Grid CSS, mobile-first, same breakpoints and sizing as the prior fix:**

```css
:host {
  display: block;
  box-sizing: border-box;
  height: 100%;
  overflow: hidden;
  container-type: size;
  container-name: room-page;
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}

.room-layout {
  display: grid;
  grid-template-areas: "header" "stage" "audience" "comments";
  grid-template-columns: 1fr;
  grid-template-rows: auto minmax(0, 30cqh) minmax(22cqh, 1fr) minmax(0, 50%);
  height: 100%;
  overflow: hidden;
}

.room-header { grid-area: header; position: relative; z-index: var(--z-overlay); }
.stage-section { grid-area: stage; display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
.stage-section app-stage-grid { flex: 1 1 auto; min-height: 0; }
.audience-section { grid-area: audience; min-height: 0; min-width: 0; overflow: hidden; }
.comments-section { grid-area: comments; display: flex; flex-direction: column; min-height: 0; overflow: hidden; }

@container room-page (min-width: 480px) {
  .room-layout { grid-template-rows: auto minmax(0, 34cqh) minmax(22cqh, 1fr) minmax(0, 50%); }
}

@container room-page (min-width: 1024px) {
  :host { padding-top: var(--app-header-height); padding-bottom: 0; }
  .room-layout {
    grid-template-areas: "header comments" "stage comments" "audience comments";
    grid-template-columns: minmax(0, 1fr) var(--comments-panel-width);
    grid-template-rows: auto auto minmax(0, 1fr);
  }
  .stage-section { max-height: none; }
  .comments-section { max-height: none; }
}
```

This produces the identical visual result and the identical two-tier breakpoint behavior
the prior pass (`2026-07-02-room-page-mobile-layout-design.md`) already validated — same
`cqh` caps, same flex-stretch-for-scroll pattern on `.stage-section app-stage-grid` — just
expressed as one flat grid with named areas instead of three nested flex/grid boxes. No
child component (`stage-grid`, `audience-list`, `comments-panel`) needs to change; each
already stretches correctly to fill whatever box it's given.

**3.3 — Header-offset fix, scoped to this component only.** See §1's third finding.
`:host`'s `padding-top`/`padding-bottom` (in §3.2) handle both cases:
- **Mobile (< 1024px, immersive):** the global header and bottom nav are hidden (§2), so
  `:host` reserves `env(safe-area-inset-top)` / `env(safe-area-inset-bottom)` for notches
  and home-indicators instead — nothing else covers this space now.
- **Desktop (≥ 1024px, not immersive):** the global `app-header` is visible and
  `position: fixed`, with no space reserved for it anywhere in the shared shell.
  `:host`'s own `padding-top: var(--app-header-height)` (combined with
  `box-sizing: border-box`, so the reserved space comes out of the existing `height: 100%`
  rather than growing past it) reserves that space **within the Room Page's own slot only**
  — no shared shell CSS changes, no effect on any other route.

## 4. What does not change

- Visual hierarchy, section order, and breakpoint values (1024px desktop switch, 480px
  stage-cap bump) — identical to today.
- `stage-grid.ts`, `audience-list.ts`, `comments-panel.ts`, `room-header.ts` internals —
  none require changes; they already stretch correctly as grid/flex children.
- Desktop sidebar and app-header behavior, on every route including rooms.
- Any inputs/outputs, data flow, or realtime/socket logic — this is layout/CSS/template
  structure only.
- `video-room-page.ts` (see explicit scope note above).

## 5. Verification plan

- `ng build` — confirms template/CSS compiles cleanly (grid-template-areas typos are a
  common silent-failure mode; the build won't catch mis-named areas, so this is followed
  by manual visual checks).
- `npm run lint:styles` (stylelint) — SCSS convention compliance.
- Manual check in a running dev server across three widths (a small phone ~375px, a
  tablet-ish ~768px, and desktop ≥1024px), in both light and dark themes: confirm the
  global header/bottom-nav are hidden on mobile room routes and present on every other
  mobile route; confirm stage/audience/comments size and scroll exactly as they did before
  this change (no new clipping, no new overflow); confirm safe-area insets are respected
  on the immersive mobile layout (can be approximated in Chrome DevTools' device toolbar
  with a notched device preset).
- No new ESLint boundaries violations expected: `room.routes.ts`'s new `data` field is
  feature-internal; `app.ts`'s new `Router` injection and `header`/`sidenav`
  `:host-context` rules touch only files that already depend on each other today.
