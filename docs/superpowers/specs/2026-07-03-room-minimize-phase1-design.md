# Room Minimize (Phase 1) — Stay Connected While Browsing

**Date:** 2026-07-03
**Scope:** Voice room only (`RoomPageComponent`). A new, always-visible "minimize" action
in `room-header.ts` that shrinks the room into a draggable floating status bar, lets the
user navigate anywhere else in the app while the audio connection stays alive, and restores
the full room view on tap. Only one room can be minimized at a time.

**Explicitly out of scope for this phase:**
- `VideoRoomPageComponent` — not touched.
- Multiple simultaneous minimized rooms — joining a second room while one is minimized
  prompts to leave the first (exact UX for that prompt is a detail to work out during
  implementation, not specified further here).
- Surviving a hard refresh or tab close. This phase only survives in-app (router) navigation.
  A follow-up phase will add `sessionStorage` persistence and an auto-rejoin flow on reload —
  a separately-scoped problem with its own failure modes (room ended while away, stale RTC
  token, etc.) and its own design.

## 1. Problem

Today, leaving the room route in any way — clicking "Leave," navigating to another page, or
closing the tab — runs the exact same teardown. `RoomPageBase`'s constructor
(`room-page-base.ts:147-162`) registers a `DestroyRef.onDestroy()` callback that
unconditionally calls `rcs.leave()`, `roomStore.leaveRoom()`, and resets every room store
(`StageStore`, `AudienceStore`, `CommentsStore`, `InRoomRtmStore`, `GiftsStore`, `ModStore`,
`GoodieStore`). There's no way to navigate elsewhere without ending the call.

Separately, `room-page.ts`'s `providers: []` includes `RoomConnectionService` — even though
that service is already `@Injectable({ providedIn: 'root' })` (verified in
`core/realtime/room-connection.service.ts:8`), listing it in the component's own providers
creates a fresh, page-scoped instance that shadows the root singleton and is destroyed with
the page. `BffRoomSocketService` (`core/realtime/bff-room-socket.service.ts:8`) is *not*
re-provided this way, so it already resolves to the true root singleton — its connection
lifecycle is currently controlled entirely by explicit `.connect()`/`.disconnect()` calls in
the page's own code, not by DI destruction.

## 2. Architecture

### 2.1 — Stop shadowing `RoomConnectionService`

Remove `RoomConnectionService` from `room-page.ts`'s `providers: []`. `inject(RoomConnectionService)`
in `RoomPageBase` then resolves to the actual root singleton, matching `BffRoomSocketService`'s
existing behavior. This is the only change needed to make the underlying Agora RTC connection
capable of surviving the page's destruction — the connection mechanics themselves are
otherwise untouched.

### 2.2 — New root store: `ActiveCallStore`

A new file, `store/active-call.store.ts`, following the exact pattern already established by
`store/notification.store.ts` and `store/theme.store.ts` (`@Injectable({ providedIn: 'root' })`,
one store per concern, per CLAUDE.md §7). It holds only what the minimized bar needs to
render and act — nothing that belongs to the full room view:

```ts
@Injectable({ providedIn: 'root' })
export class ActiveCallStore {
  readonly cname = signal<string | null>(null);
  readonly busiType = signal<number>(2);
  readonly roomName = signal('');
  readonly isMicOn = signal(false);
  readonly minimized = computed(() => this.cname() !== null);

  minimize(cname: string, busiType: number, roomName: string, isMicOn: boolean): void { ... }
  updateMicState(isMicOn: boolean): void { ... }
  clear(): void { ... }
}
```

`RoomStore` itself — `roomLevelInfo`, `rtcInfo`, `topic`, moderator/host flags, everything
else — stays exactly where it is today: a page-scoped provider, destroyed on minimize along
with `StageStore`/`AudienceStore`/`CommentsStore`/etc. The minimized bar doesn't need any of
that detail, and duplicating it into a root store would be exactly the kind of redundant
state CLAUDE.md §7 warns against.

### 2.3 — Gate the teardown

`RoomPageBase`'s constructor teardown (§1) becomes conditional on whether the destruction is
a minimize or a real leave:

```ts
this.destroyRef.onDestroy(() => {
  this._destroying.set(true);
  this.typingPruneSub?.unsubscribe();
  if (this.activeCallStore.minimized() && this.activeCallStore.cname() === this.roomStore.cname()) {
    return;
  }
  this.rcs.leave().catch(() => {}).finally(() =>
    this.roomStore.leaveRoom().finally(() => {
      this.stageStore.reset();
      this.audienceStore.reset();
      this.commentsStore.reset();
      this.rtmStore.reset();
      this.giftsStore.reset();
      this.modStore.reset();
      this.goodieStore.endGame();
    }),
  );
});
```

The cname comparison guards against a real edge case: if the user minimizes room A, then
somehow ends up destroying a *different* room page instance (shouldn't happen in normal
navigation, but is cheap to guard against), that other instance's teardown must still run
normally.

### 2.4 — The minimize action

A new, always-visible toolbar button in `room-header.ts` (not hidden behind the existing
overflow "more" menu — placed as a direct sibling to the other always-visible buttons, e.g.
next to the refresh button). Clicking it:

1. Calls `activeCallStore.minimize(cname, busiType, roomName, roomStore.isMicOn())`.
2. Navigates back to wherever the user came from (`Location.back()` via Angular's `Location`
   service, which reads the browser's session history — this is the standard Angular
   mechanism for "go back," distinct from `router.navigate()` which always goes forward to a
   specified path). If there's no in-app previous entry (e.g. the room was opened via a direct
   link in a new tab), falls back to `router.navigate(['/rooms/voice'])`.

`RoomPageBase` already exposes `onLeave()` as the explicit-leave path (`room-page-base.ts:352`)
— minimize is a new, separate method (`onMinimize()`), not a variant of `onLeave()`, since it
must *not* trigger the teardown at all.

### 2.5 — The floating bar component

A new component, `MinimizedRoomBar`, rendered in `app.ts`'s template as a sibling to
`<app-toast-container />` — the same "outside the router-outlet, survives navigation on its
own" position already established for that component:

```html
@if (activeCallStore.minimized()) {
  <app-minimized-room-bar />
}
```

Content (per the earlier "slim status bar" decision): room name, a mic mute/unmute toggle
(calling `rcs.setMicEnabled()` directly on the still-alive root `RoomConnectionService`, then
`activeCallStore.updateMicState(...)`), and tapping the bar itself (anywhere except the mic
button) navigates to `/room/:cname/:busiType` to restore the full view. Draggable via
`@angular/cdk/drag-drop`'s `cdkDrag` directive (`@angular/cdk` is already a project
dependency; the drag-drop sub-module is not yet imported anywhere and will be a new import,
alongside the CDK `Dialog` module already in use). `cdkDrag` alone permits dragging fully off
the visible viewport, so the drag must be constrained with `cdkDragBoundary` bound to a
full-viewport reference element (e.g. `app.ts`'s own `.app-shell` root), and the bar's own
CSS should additionally keep clear of the mobile bottom-nav / immersive safe-area regions
already established elsewhere in this app shell.

This component belongs in `core/layout/` alongside `header.component.ts`/`sidenav.component.ts`
— it's app-shell chrome, not a feature-owned UI piece, and it needs to inject `ActiveCallStore`
(a `store/`-layer dependency), which `core/` is permitted to depend on per CLAUDE.md §2's
layering rules (`core` → `store` is not listed as an allowed edge in the dependency table,
so this needs the same inversion pattern already used for `ERROR_REPORTER`: `core/layout/`
defines an abstraction the component depends on, and `app.config.ts` binds it to the real
`ActiveCallStore`). *(Flagged for the plan to work out precisely — see §5.)*

### 2.6 — Restoring without reconnecting

Tapping the bar navigates to `/room/:cname/:busiType`, remounting `RoomPageComponent`, which
runs `doEnterRoom()` unconditionally today — re-joining, re-fetching the join bundle, and
calling `rcs.connect(...)` regardless of whether a connection already exists. `doEnterRoom()`
needs a new branch: if `activeCallStore.minimized()` is true and its `cname`/`busiType` match
the route's, this is a restore, not a fresh join —
- Skip `roomStore.joinRoom(...)` and `rcs.connect(...)` (already connected).
- Still fetch the join bundle and populate `StageStore`/`AudienceStore`/`CommentsStore` fresh
  (those were reset in §2.3's non-firing teardown's absence — they were never touched while
  minimized, but the *page* that displayed them was destroyed, so a new page instance starts
  with empty stores and needs the current roster/comments).
- Call `activeCallStore.clear()` once the restore completes, since the room is no longer
  "elsewhere" — it's back in full view.

## 3. What does not change

- `VideoRoomPageComponent`, `AudienceListComponent`'s internal collapse, and every other
  out-of-scope item from the earlier mobile-first redesign work remain untouched.
- `StageStore`, `AudienceStore`, `CommentsStore`, `ModStore`, `GiftsStore`, `InRoomRtmStore`,
  `GoodieStore` — all stay page-scoped `@Injectable()` providers, exactly as CLAUDE.md §7
  requires for feature stores. Only the connection services and the new slim
  `ActiveCallStore` are root-scoped, and both are justified by CLAUDE.md §7's own carve-out
  for state whose "lifecycle is the whole app."
- The explicit "Leave" button's behavior (`onLeave()`) is unchanged — it still fully tears
  down the connection and navigates to `leaveNavTarget`.

## 4. Verification plan

- `ng build` and `npm run lint:styles` as usual.
- Manual walkthrough: join a room, minimize, confirm audio keeps flowing (e.g. another
  participant's speaking indicator/audio continues) while browsing to `/rooms/voice`,
  `/messages`, and `/profile`. Drag the bar around, including near the mobile bottom-nav
  safe area. Tap to restore — confirm the full room view reappears with a live stage/audience/
  comments refetch and no audio glitch (no reconnect happening). Toggle mic while minimized
  and confirm the change is reflected both in the bar and after restoring. Click "Leave" from
  the full view after restoring — confirm the connection actually ends this time.

## 5. Open questions for the implementation plan

- The exact `core` → `store` layering inversion for `MinimizedRoomBar` (§2.5) needs to be
  worked out concretely — likely a new `ACTIVE_CALL_READER` token in `core/tokens/`, bound to
  `ActiveCallStore` in `app.config.ts`, mirroring the existing `ERROR_REPORTER`/
  `NOTIFICATION_REPORTER` pattern.
- Exact UX for "user tries to join a second room while one is minimized" (blocked entirely,
  or a confirm-and-replace prompt) is deferred to implementation-time judgment unless the
  user wants to specify it now.
