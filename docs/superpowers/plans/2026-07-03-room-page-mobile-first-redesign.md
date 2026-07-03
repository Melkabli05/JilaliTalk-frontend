# Room Page Mobile-First Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the voice Room Page's mobile layout mobile-first: the global app shell
goes immersive (hides the fixed header + bottom nav) on mobile room routes, and
`room-page.ts`'s 3-level nested flex/grid template collapses into one flat CSS Grid with
named areas.

**Architecture:** A route `data: { immersive: true }` flag on the voice room route drives
a signal in the root `App` component; `HeaderComponent` and `SidenavComponent` read that
ancestor state via `:host-context(.app-shell.immersive)` (the same pattern already used
for `:host-context(.dark)`) to hide their mobile chrome with CSS only — no component is
destroyed/recreated. `room-page.ts`'s template is flattened to make `room-header`,
`.stage-section`, `.audience-section`, and `.comments-section` direct grid children of one
`.room-layout` grid with `grid-template-areas`, using the same `cqh`-based breakpoints and
sizing the prior mobile-layout fix already validated.

**Tech Stack:** Angular 22 (zoneless, signals, `@container` queries), no new dependencies.

## Global Constraints

- Scope is `features/room/pages/room-page.ts` (voice room) plus `app.ts`,
  `core/layout/header.component.ts`, `core/layout/sidenav.component.ts`, and
  `features/room/room.routes.ts`. Do **not** touch `video-room-page.ts` or
  `audience-list.ts`'s internal `matchMedia` collapse — both are explicitly out of scope
  (see spec §"Explicitly out of scope").
- Do not modify `room-header.ts` — it has an in-progress uncommitted change; treat it as a
  fixed-height grid slot only.
- Preserve every existing visual breakpoint and sizing number from the prior
  `2026-07-02-room-page-mobile-layout-design.md` fix (`30cqh`/`34cqh` stage caps, `22cqh`
  audience floor, `50%` comments cap, 480px/1024px breakpoints) — this plan restructures
  the CSS mechanics, not the numbers.
- No manual `.subscribe()` without `takeUntilDestroyed` — N/A here (no new subscriptions;
  `toSignal` handles cleanup automatically).
- Every component stays `ChangeDetectionStrategy.OnPush`; no `standalone: true` anywhere.
- No hardcoded colors — this plan introduces no new colors.
- Desktop behavior (≥1024px: sidebar, app-header, room page 2-column grid) must be
  pixel-identical to today after every task.

---

## File Structure

- Modify: `src/app/features/room/room.routes.ts` — add `data: { immersive: true }` to the
  voice room route only.
- Modify: `src/app/app.ts` — inject `Router`, derive an `immersive` signal from route data,
  bind it to `.app-shell`, make `.app-main`'s bottom padding conditional on it.
- Modify: `src/app/core/layout/header.component.ts` — hide `.app-header` on mobile when an
  ancestor `.app-shell` has `.immersive`.
- Modify: `src/app/core/layout/sidenav.component.ts` — hide `.mobile-nav` under the same
  condition.
- Modify: `src/app/features/room/pages/room-page.ts` — flatten the template, replace the
  nested flex/grid styles with one named-area CSS Grid.

No new files. No existing test files are affected (`room-header.spec.ts` and
`handle-realtime-event.util.spec.ts` don't touch any of the above).

---

### Task 1: App Shell immersive signal (route flag + `app.ts`)

**Files:**
- Modify: `src/app/features/room/room.routes.ts`
- Modify: `src/app/app.ts`

**Interfaces:**
- Produces: `App.immersive: Signal<boolean>` — `true` only when the deepest activated
  route's `data['immersive']` is `true`. Consumed by Task 2 (via the `.app-shell.immersive`
  class already bound in this task) and verified in Task 4.

- [ ] **Step 1: Add the route data flag**

In `src/app/features/room/room.routes.ts`, add `data: { immersive: true }` to the voice
room route only (not the `video/:cname/:busiType` route):

```ts
import { Routes } from '@angular/router';

export const roomRoutes: Routes = [
  {
    path: ':cname/:busiType',
    title: 'Room',
    data: { immersive: true },
    loadComponent: () =>
      import('./pages/room-page').then((m) => m.RoomPageComponent),
  },
  {
    path: 'video/:cname/:busiType',
    title: 'Video Room',
    loadComponent: () =>
      import('./pages/video-room-page').then((m) => m.VideoRoomPageComponent),
  },
  {
    path: '',
    title: 'Room',
    redirectTo: 'voice/2',
    pathMatch: 'full',
  },
];
```

- [ ] **Step 2: Rewrite `app.ts` to derive and bind the `immersive` signal**

Replace the full contents of `src/app/app.ts` with:

```ts
import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet, type ActivatedRouteSnapshot } from '@angular/router';
import { filter, map } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { SidenavComponent } from '@core/layout/sidenav.component';
import { HeaderComponent } from '@core/layout/header.component';
import { ImBootstrapService } from '@core/realtime/im-bootstrap.service';
import { ToastContainerComponent } from '@shared/ui/toast/toast-container.component';
import { PwaUpdateBannerComponent } from '@shared/ui';
import { PwaUpdateService } from '@core/services/pwa-update.service';

/** Walks to the deepest activated route and reports whether it opted into immersive mode. */
function isImmersiveRoute(root: ActivatedRouteSnapshot): boolean {
  let node = root;
  while (node.firstChild) node = node.firstChild;
  return node.data['immersive'] === true;
}

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, SidenavComponent, HeaderComponent, ToastContainerComponent, PwaUpdateBannerComponent],
  template: `
    <div class="app-shell" [class.immersive]="immersive()">
      <app-sidenav />
      <div class="main-wrapper">
        <app-header />
        <main class="app-main" id="main-content" tabindex="-1">
          <router-outlet />
        </main>
      </div>
    </div>
    <app-toast-container />
    @if (pwaUpdate.updateAvailable()) {
      <app-pwa-update-banner />
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .app-shell {
        display: grid;
        grid-template-columns: 1fr;
        /* Small viewport height — the guaranteed-visible area even with the
           browser's address/tab bars fully expanded. dvh recalculates as
           those bars animate, which can transiently exceed what's actually
           visible and make the page scroll; svh never does. */
        height: 100svh;
        overflow: hidden;
      }
      @media (min-width: 1024px) {
        .app-shell {
          grid-template-columns: var(--sidebar-width) 1fr;
        }
      }

      .main-wrapper {
        display: block; /* hosts the absolutely-positioned header; pages render below */
        position: relative;
        min-height: 0;
        overflow: hidden;
      }

      /* The ONLY scroll container. Fills the slot — header floats above. */
      .app-main {
        height: 100%;
        min-height: 0;
        overflow-y: auto;
        overflow-x: hidden;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: thin;
        scrollbar-gutter: stable;
        scrollbar-color: var(--color-neutral-300) transparent;
        /* room for the fixed mobile bottom nav */
        padding-bottom: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom));
      }
      .app-main::-webkit-scrollbar {
        width: 6px;
      }
      .app-main::-webkit-scrollbar-thumb {
        background-color: var(--color-neutral-300);
        border-radius: 3px;
      }
      @media (min-width: 1024px) {
        .app-main {
          padding-bottom: 0;
        }
      }

      /* Immersive routes (mobile room pages) hide the global header and bottom nav —
         see :host-context(.app-shell.immersive) in header/sidenav components — so
         .app-main no longer needs to reserve space for the bottom nav here. */
      @media (max-width: 1023.98px) {
        .app-shell.immersive .app-main {
          padding-bottom: env(safe-area-inset-bottom);
        }
      }
    `,
  ],
})
export class App {
  private readonly imBootstrap = inject(ImBootstrapService);
  private readonly router = inject(Router);
  readonly pwaUpdate = inject(PwaUpdateService);

  readonly immersive = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => isImmersiveRoute(this.router.routerState.snapshot.root)),
    ),
    { initialValue: false },
  );
}
```

- [ ] **Step 3: Verify it builds**

Run: `npx ng build`
Expected: build succeeds with no new errors or warnings attributable to `app.ts` or
`room.routes.ts`.

- [ ] **Step 4: Manual sanity check**

Run `npm start`, open the app in a browser, and use devtools to inspect the `<div
class="app-shell">` element:
- On `/rooms/voice` (or any non-room route): the element has no `immersive` class.
- On `/room/<any-cname>/2` (the voice room route): the element has the `immersive` class,
  even if the room itself fails to join (the class reflects the route, not the join
  outcome).

- [ ] **Step 5: Commit**

```bash
git add src/app/app.ts src/app/features/room/room.routes.ts
git commit -m "feat(shell): add immersive route flag for mobile room pages"
```

---

### Task 2: Hide global header + bottom nav in immersive mode

**Files:**
- Modify: `src/app/core/layout/header.component.ts`
- Modify: `src/app/core/layout/sidenav.component.ts`

**Interfaces:**
- Consumes: the `.app-shell.immersive` class from Task 1 (ancestor of both components in
  the DOM tree via `app.ts`'s template).
- Produces: `.app-header` and `.mobile-nav` both hidden below 1024px whenever an ancestor
  `.app-shell` has `.immersive`; unaffected above 1024px or when `.immersive` is absent.
  Nothing downstream depends on new exports — this is a terminal CSS-only change.

- [ ] **Step 1: Hide the header on mobile immersive routes**

In `src/app/core/layout/header.component.ts`, inside the `styles` array, immediately after
the existing `.app-header` / `@media (min-width: 1024px) { .app-header { ... } }` rules
(right after the closing brace of that media block, before `/* Brand */`), add:

```css
    /* Immersive routes (mobile room pages) hide the global header entirely — the
       room's own header becomes the only top chrome. Desktop is unaffected. */
    @media (max-width: 1023.98px) {
      :host-context(.app-shell.immersive) .app-header {
        display: none;
      }
    }
```

- [ ] **Step 2: Hide the mobile bottom nav on immersive routes**

In `src/app/core/layout/sidenav.component.ts`, inside the `styles` array, immediately
after the existing `@media (min-width: 1024px) { .mobile-nav { display: none; } }` rule,
add:

```css
    /* Immersive routes (mobile room pages) hide the bottom nav so the room gets the
       full viewport height. Desktop sidebar is unaffected. */
    @media (max-width: 1023.98px) {
      :host-context(.app-shell.immersive) .mobile-nav {
        display: none;
      }
    }
```

- [ ] **Step 3: Verify it builds**

Run: `npx ng build`
Expected: build succeeds, no new errors.

- [ ] **Step 4: Verify stylelint passes**

Run: `npm run lint:styles`
Expected: no new violations in `header.component.ts` or `sidenav.component.ts`.

- [ ] **Step 5: Manual check at mobile width**

Run `npm start`. In the browser, resize the viewport to ~375px wide (or use devtools
device toolbar):
- Navigate to `/rooms/voice`: the app-header (logo/notifications/coins) and bottom nav
  (Voice/Live/Private tabs) are both visible.
- Navigate to `/room/<any-cname>/2`: both are hidden; only the room's own content (and its
  own `room-header` toolbar) occupies the screen.
- Resize to ≥1024px wide on the room route: the desktop sidebar and app-header are visible
  again (immersive mode only applies below 1024px).

- [ ] **Step 6: Commit**

```bash
git add src/app/core/layout/header.component.ts src/app/core/layout/sidenav.component.ts
git commit -m "feat(shell): hide header and bottom nav on mobile immersive routes"
```

---

### Task 3: Flatten `room-page.ts` into one named-area CSS Grid

**Files:**
- Modify: `src/app/features/room/pages/room-page.ts`

**Interfaces:**
- Consumes: nothing new — all `@Input`/`@Output` bindings on `app-room-header`,
  `app-stage-grid`, `app-audience-list`, `app-comments-panel` are unchanged from the
  current file; only the wrapping template structure and styles change.
- Produces: nothing new is exposed — this is a template/CSS-only change internal to
  `RoomPageComponent`. `RoomPageComponent`'s public surface (`cname`, `busiType`,
  `visible` inputs; the class extending `RoomPageBase`) is untouched.

- [ ] **Step 1: Replace the template**

In `src/app/features/room/pages/room-page.ts`, the `@Component` decorator's `template`
currently wraps `room-header`, `.stage-section`, and `.audience-section` inside
`.room-body > .left-column`, with `.comments-section` as a sibling of `.left-column`
inside `.room-body`. Replace that wrapping structure — keep every binding on the four
child components byte-for-byte identical, only remove the `.room-body` and `.left-column`
wrapper `<div>`s so all four sections become direct children of `.room-layout`:

```html
<div class="room-layout">
      <div class="room-header">
        <app-room-header
          [name]="roomStore.name()"
          [topic]="roomStore.topic()"
          [cname]="roomStore.cname() ?? ''"
          [isMicOn]="roomStore.isMicOn()"
          [micSpeaking]="selfSpeaking()"
          [micBusy]="mediaToggleBusy()"
          [isHandRaised]="roomStore.isHandRaised()"
          [isOnStage]="stageStore.isOnStage(roomStore.userId())"
          [isModerator]="roomStore.isModerator()"
          [invisible]="!roomStore.isVisible()"
          [refreshing]="refreshingRoom()"
          [captionEnabled]="captionEnabled()"
          [wsStatus]="bffWs.wsStatus()"
          (toggleMic)="onMediaToggle()"
          (toggleCamOrShare)="onToggleCamOrShare()"
          (toggleHand)="onToggleHand()"
          (gift)="onGift()"
          (pitch)="onPitch()"
          (managers)="onManagers()"
          (reward)="onReward()"
          (toggleCaption)="onToggleCaption()"
          (toggleInvisible)="onToggleInvisible()"
          (refresh)="onRefreshRoom()"
          (leave)="onLeave()"
        />
      </div>

      <section class="stage-section">
        <app-stage-grid [users]="stageStore.stageUsers()" [speakingUids]="rcs.speakingUids()" (userClick)="onStageUserClick($event)" />
      </section>

      <section class="audience-section">
        <app-audience-list
          [users]="audienceWithGhosts()"
          [speakingUids]="rcs.speakingUids()"
          [currentUserId]="roomStore.userId()"
          [canInviteToStage]="roomStore.isHost()"
          [inviteBusy]="inviteBusy()"
          (userClick)="onAudienceUserClick($event)"
          (inviteToStage)="onInviteToStage($event)"
        />
      </section>

      <aside class="comments-section">
        <app-comments-panel
          [comments]="commentsStore.comments()"
          [captions]="commentsStore.captions()"
          [currentUserId]="roomStore.userId()"
          [refreshing]="refreshingComments()"
          [typingNames]="typingNames()"
          (sendComment)="onSendComment($event)"
          (typing)="onTyping()"
          (refresh)="onRefreshComments()"
          (loadCaptions)="onLoadCaptions()"
        />
      </aside>
    </div>

    @if (showSignin()) {
      <app-signin-panel
        [cname]="roomStore.cname() ?? ''"
        [hostId]="roomStore.userId()"
        [roomLevel]="roomStore.roomLevelInfo()?.level ?? 1"
        [roomLevelIcon]="roomStore.roomLevelInfo()?.levelIconV2 ?? roomStore.roomLevelInfo()?.levelIcon ?? null"
        (onClose)="showSignin.set(false)"
      />
    }
```

- [ ] **Step 2: Replace the styles**

Replace the entire `styles` array of the same `@Component` decorator with:

```css
    /* :host is sized by .app-main (see app.ts) and, on desktop, additionally
       reserves space for the fixed global app-header (see @container rule below) —
       the room page must never compute its own vh/dvh. Layout adapts to the slot
       width/height via @container, not the viewport. */
    :host {
      display: block;
      box-sizing: border-box;
      height: 100%;
      overflow: hidden;
      container-type: size;
      container-name: room-page;
      /* Mobile: the app shell goes immersive (see app.ts / header / sidenav) and hides
         its own header + bottom nav, so this component owns safe-area insets instead. */
      padding-top: env(safe-area-inset-top);
      padding-bottom: env(safe-area-inset-bottom);
    }

    .room-layout {
      display: grid;
      grid-template-areas: "header" "stage" "audience" "comments";
      grid-template-columns: 1fr;
      /* Mobile-first: stage is capped, audience has a guaranteed floor and grows,
         comments takes up to half the available height. Same numbers as the
         2026-07-02 mobile-layout fix, now expressed as grid tracks. */
      grid-template-rows: auto minmax(0, 30cqh) minmax(22cqh, 1fr) minmax(0, 50%);
      height: 100%;
      overflow: hidden;
    }

    .room-header {
      grid-area: header;
      position: relative;
      z-index: var(--z-overlay);
    }

    .stage-section {
      grid-area: stage;
      display: flex;
      flex-direction: column;
      min-height: 0;
      min-width: 0;
      overflow: hidden;
    }
    .stage-section app-stage-grid {
      flex: 1 1 auto;
      min-height: 0;
    }

    .audience-section {
      grid-area: audience;
      min-height: 0;
      min-width: 0;
      overflow: hidden;
    }

    .comments-section {
      grid-area: comments;
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
    }

    /* Tablet-sized mobile: a touch more stage room. */
    @container room-page (min-width: 480px) {
      .room-layout { grid-template-rows: auto minmax(0, 34cqh) minmax(22cqh, 1fr) minmax(0, 50%); }
    }

    /* Desktop: two-column grid, comments becomes a full-height sidebar. The global
       app-header is visible again here (immersive mode only applies below 1024px), so
       :host reserves space for it — no shared shell CSS is touched for this. */
    @container room-page (min-width: 1024px) {
      :host {
        padding-top: var(--app-header-height);
        padding-bottom: 0;
      }
      .room-layout {
        grid-template-areas: "header comments" "stage comments" "audience comments";
        grid-template-columns: minmax(0, 1fr) var(--comments-panel-width);
        grid-template-rows: auto auto minmax(0, 1fr);
      }
      .stage-section { max-height: none; }
      .comments-section { max-height: none; }
    }
```

- [ ] **Step 3: Verify it builds**

Run: `npx ng build`
Expected: build succeeds, no new errors or warnings.

- [ ] **Step 4: Verify stylelint passes**

Run: `npm run lint:styles`
Expected: no new violations in `room-page.ts`.

- [ ] **Step 5: Manual visual check across breakpoints**

Run `npm start`, navigate to a voice room (`/room/<any-cname>/2`) and check at three
widths (use devtools device toolbar or manual window resize):
- **~375px (phone):** header, stage, audience, comments stack vertically top to bottom in
  that order; stage does not clip speakers without a scrollbar if there are more than fit;
  audience always shows a usable amount of space even with stage and comments both at
  their caps; comments never exceeds half the screen height.
- **~768px (tablet-ish, still < 1024px):** same stacked order, stage gets a slightly taller
  cap (`34cqh`) than at 375px.
- **≥1024px (desktop):** two-column layout — header/stage/audience on the left, comments
  as a full-height right sidebar of width `var(--comments-panel-width)`.

Also confirm both light and dark themes render without visual regressions (toggle via the
theme toggle in the header, on desktop width where the header is visible).

- [ ] **Step 6: Commit**

```bash
git add src/app/features/room/pages/room-page.ts
git commit -m "refactor(room-page): flatten layout into one named-area CSS grid"
```

---

### Task 4: Full integration verification

**Files:** none (verification only).

**Interfaces:** N/A — this task exercises Tasks 1–3 together and does not modify code.

- [ ] **Step 1: Full production-mode build**

Run: `npx ng build --configuration production`
Expected: build succeeds with no errors.

- [ ] **Step 2: Full stylelint pass**

Run: `npm run lint:styles`
Expected: zero violations across the whole `src/` tree (not just the files touched in this
plan) — confirms no regressions were introduced elsewhere.

- [ ] **Step 3: Combined manual walkthrough**

Run `npm start`. At ~375px width:
1. Load `/rooms/voice` — confirm the global header and bottom nav are both visible (not
   immersive).
2. Navigate into a voice room from a room card — confirm the transition hides both the
   global header and bottom nav, and the room's own header/stage/audience/comments occupy
   the full available height with no visible gap or overlap where the hidden chrome used
   to be.
3. Trigger the "Leave" action in the room header — confirm navigating back to
   `/rooms/voice` (or wherever `leaveNavTarget` points) restores the global header and
   bottom nav.
4. Resize to ≥1024px while still on the room route — confirm the desktop sidebar,
   app-header, and two-column room grid all render correctly, with the room's own content
   starting cleanly below the fixed app-header (no overlap).
5. Repeat steps 1–4 in dark mode.

- [ ] **Step 4: Confirm no other route regressed**

At ~375px width, spot-check `/rooms/live`, `/rooms/private`, `/messages`, and `/profile` —
confirm the global header and bottom nav are visible and unchanged on all of them (only
the voice room route is immersive).

- [ ] **Step 5: Final commit (if any fixups were needed)**

If steps 1–4 required any fixes, stage and commit them individually with a message
describing what was wrong and how it was fixed. If no fixes were needed, this task
requires no commit — the three commits from Tasks 1–3 stand as the complete change set.
