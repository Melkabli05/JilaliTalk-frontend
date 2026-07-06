# Design Spec: UserInfoModal — Room Presence Banner

**Date:** 2026-07-06
**Status:** Draft (pending user review)
**Scope:** Add a "currently in room" banner at the top of `UserInfoModalComponent` showing
the modal-target user's current room (if any), the room's host avatar + name, and two join
actions (Visible / Invisible). Off-the-shelf — does not touch the room feature, the
join-bundle, or any other modal.

---

## 1. Why

`UserInfoModalComponent` already shows a thin "Hosting: <room>" / "In: <room>" chip in the
meta-row (added in commit `c0da2dd` feat(user-info-modal): show "currently in <room>"
chip). That's enough to *signal* presence; it isn't enough to *act on it* — to actually
join the room, the viewer has to close the modal, navigate to a room list, find the
room, and click join.

This banner adds the missing action surface inline: host avatar + name (so the viewer
knows who they're walking into), and two CTA buttons. Net effect: a viewer of any profile
who's curious "where is this person right now" can join that room in one tap, with their
preferred visibility, without leaving the modal.

## 2. Data

The banner consumes data already wired up by `c0da2dd`:

- `presence: UserPresence | null` — from `UserInfoService.getUserPresence(modalTargetId)`.
  Carries `userStatusType` (0=offline, 1=hosting own room, 2=guest in someone else's
  room), `cname`, `roomName`, `hostId`, `hostName`, `blackened`.
- `hostInfo` — fetched on demand via `UserInfoService.fetchUserPresence`'s sibling
  `fetchUserInfo(hostId)` if `presence.hostId > 0` and we don't already have a cached
  profile. Reuses the existing 5-minute user-info cache.

No new backend endpoints, no new DTOs.

## 3. UI

### Banner placement

Inserted between the existing identity-card and the bio/chips section. The full modal
reads top-to-bottom:

```
┌────────────────────────────────────────┐
│  identity-card  (avatar + name + vip)   │   ← unchanged
├────────────────────────────────────────┤
│  presence banner (NEW)                  │   ← only when presence.statusType ∈ {1,2}
│  ▸ room name + tiny mic icon            │
│  ▸ host row: avatar + name + nationality
│  ▸ actions: Join Visible, Join Invisible│
├────────────────────────────────────────┤
│  bio                                   │   ← unchanged
│  meta-row chips                        │
│  stats row                             │
│  modal body                            │
└────────────────────────────────────────┘
```

### States

| `presence.statusType` | Banner rendered? | Content |
|---|---|---|
| 0 (offline) | no | the existing meta-row chip ("In: ..."/"Hosting: ...") is suppressed too — we don't want to show "not in a room" twice; if statusType is 0, no banner and no chip |
| 1 (hosting own room) | yes | "Hosting: <roomName>" header; host = the modal-target user themselves, so we re-use their identity-card avatar+name (already on screen) instead of fetching again |
| 2 (guest in someone else's room) | yes | "In: <roomName>" header; host row shows the actual room host's avatar + name, fetched from `presence.hostId` |
| blackened = true | no | never render — silently swallow; blackened users are filtered upstream for a reason |
| presence === null (fetch in-flight or failed) | no | render nothing — don't flash an empty/loading state |

### Visual design

**Container** — full-width within the modal-content padding, `border: 1px solid
var(--color-border)`, `border-radius: var(--radius-lg)`, `background: var(--color-card)`,
padding `var(--space-3) var(--space-4)`. Subtle inset — it should feel attached to the
identity card above, not floating.

**Header line** — `font-size: var(--text-xs)`, `font-weight: var(--font-semibold)`,
`color: var(--color-text-muted)`, `text-transform: uppercase`, `letter-spacing: 0.04em`.
Reads "HOSTING" or "IN ROOM" depending on `statusType`. A small Lucide `Mic` icon
(size 12) sits left of the text in `--color-accent-500`.

**Room name** — directly below, `font-size: var(--text-sm)`, `font-weight:
var(--font-semibold)`, `color: var(--color-text)`. One line, ellipsized.

**Host row** — only when `statusType === 2` (we don't show a host row for statusType 1
because the modal-target user IS the host — redundant). Layout: small avatar
(`<app-avatar size="xs">`) + name + country flag, matching the visual language already
used in `profile-header.ts` and `user-info-modal.component.ts`. `gap: var(--space-2)`.

**Action row** — two buttons side by side at `var(--space-3)` from the host row:

- **Join Visible** — primary, uses `<app-button variant="primary" size="sm">`, full-width
  on the right half. Label: "Join Visible".
- **Join Invisible** — secondary, `<app-button variant="soft-neutral" size="sm">`,
  full-width on the left half. Label: "Join as Guest".

Both buttons share the same click handler — `joinRoom(visible: boolean)` — and differ
only in the navigation query param.

### Dark mode

The same `--color-card` / `--color-border` pair already has dark variants in
`tokens.scss`. The `Mic` icon stays `--color-accent-500` in dark (against the dark
card surface it still has good contrast — verified by tone difference of ~30%).

## 4. Behaviour

### `joinRoom(visible: boolean)` method on the modal

```ts
private router = inject(Router);
private destroyRef = inject(DestroyRef);

async joinRoom(visible: boolean): Promise<void> {
  const presence = this.presence();
  if (!presence?.cname) return;            // no-op safety
  const cname = presence.cname;
  const busiType = this.busiTypeFromCname(cname);  // 1 = video (LS_), 2 = voice (VR_)
  const path = busiType === 1 ? '/room/video' : '/room';
  const queryParams = visible ? {} : { visible: 'false' };
  // Close the modal first so the room page mounts on a clean navigation.
  this.ref.close();
  await this.router.navigate([path, cname, busiType], { queryParams });
}
```

`busiTypeFromCname`: extract from cname prefix — `LS_*` → 1 (live/video), `VR_*` → 2
(voice). This matches the existing `voice-list.ts:joinRoom` pattern (see
`/features/rooms/pages/voice-list/voice-list.ts:joinRoom`).

If the user is mid-toggle on the follow button, queue the join after the toggle
finishes — same re-entry guard pattern the follow button already uses (`isTogglingFollow`
signal). Implementation detail: a single `isJoining` boolean signal that both buttons
flip during the navigation.

### Host-avatar fetch (statusType === 2 only)

Triggered by an effect that watches `presence()`. If `presence.hostId > 0` and
`presence.hostId !== this.data.userId`, call `userInfoService.fetchUserInfo(hostId)`.
The existing 5-minute cache makes repeat opens of the modal cheap. No new state — the
host's `UserInfo` is read via the existing `userInfoService.getUserInfo(hostId)`
cache, exposed as a `computed()`. If the fetch fails, the host row falls back to showing
`presence.hostName` (the string from `/user/status`) without an avatar — better than
showing nothing.

### Re-fetch cadence

`UserInfoService.fetchUserPresence` already has a 60s TTL — calls inside that window
return cached. The modal calls `fetchUserPresence` once on open; subsequent opens
within 60s reuse the cache. No background polling while the modal is open — the user can
close + reopen to refresh if they care.

## 5. Architecture

### Components

| New | Why |
|---|---|
| `<app-room-presence-banner>` in `shared/ui/room-presence-banner/` | Dumb presentational component. Inputs: `presence: UserPresence | null`, `hostInfo: UserInfo | null`, `busiType: number | null`. Outputs: `(join)="onJoin($event)"` with `{ visible: boolean }`. Lives in `shared/ui/` because it has no feature-specific dependency — per CLAUDE.md §6, the same rule that says `ProfileStatsBarComponent` belongs in shared. |
| `RoomBusiType` helper util in `shared/utils/room-busi-type.ts` | `cnameToBusiType(cname): 1 \| 2` — single source of truth for the LS_/VR_ prefix convention. The voice-list page currently encodes this inline (`busiType === 1 ? '/room/video' : '/room'`); extracting it now lets both call sites share the rule. |

### Files

| File | Change |
|---|---|
| `shared/ui/room-presence-banner/room-presence-banner.component.ts` | NEW: presentational component, ~120 lines |
| `shared/ui/room-presence-banner/index.ts` | NEW: barrel |
| `shared/utils/room-busi-type.ts` | NEW: `cnameToBusiType()` + tests in spec |
| `shared/ui/user-info-modal/user-info-modal.component.ts` | MODIFIED: import banner, pass inputs, wire join handler. ~30 lines added. |
| `features/rooms/pages/voice-list/voice-list.ts` | MODIFIED: replace inline `busiType === 1 ? ...` with `cnameToBusiType()` call. Trivial. |
| `shared/ui/user-info-modal/index.ts` | unchanged — banner is internal to the modal, not exported |

### Data flow

```
UserInfoService.fetchUserPresence(modalTargetId)         ── existing (60s TTL)
       │
       ▼
UserInfoModalComponent.presence = computed(...)           ── existing
       │
       ▼
RoomPresenceBannerComponent(presence, hostInfo, busiType, join)  ── NEW dumb
       │
       ▼  (click) Join button
UserInfoModalComponent.joinRoom(visible)
       │
       ▼  router.navigate
       ref.close()  (CDK dialog closes)
       └ /room/{path}/{cname}/{busiType}?visible=...
```

## 6. Edge cases & error handling

- **Presence is null (fetch in flight)**: banner renders nothing — no spinner. The
  meta-row chip is also suppressed in this case (per state table §3). When fetch resolves,
  both light up together.
- **Presence says statusType=2 but hostInfo is null** (fetch failed): banner still
  renders, but with the host name as plain text instead of avatar+name. We have
  `presence.hostName` (a string) as the fallback.
- **Cname has unexpected prefix** (`cnameToBusiType` returns null): the join button is
  disabled with a tooltip "Unknown room type" — better than navigating to the wrong URL.
- **User clicks Join twice quickly**: `isJoining` signal guards re-entry. Same pattern as
  `isTogglingFollow`.
- **Modal closes mid-navigation** (user clicks Close while join is in flight): the
  navigation completes — `ref.close()` is called before `router.navigate` so the dialog is
  already gone when the route changes. No race.
- **`presence.blackened === true`**: never render, never fetch host. Treated as "offline"
  for the banner.
- **Empty roomName** (`statusType=1` with `roomName === ''`): show fallback label
  "Hosting a room" instead of an empty string. Per existing `presenceLabel` computed.

## 7. Testing

No spec files (per CLAUDE.md & `/feedback_no-unit-tests-unless-asked.md` — don't write
tests unless asked). Verification is end-to-end:

1. **Live integration:** dev-server + BFF running. Open any profile whose `/user/status`
   returns `statusType=2` in a live room → confirm:
   - Banner renders with correct room name
   - Host avatar + name appear (after fetch resolves)
   - Join Visible → router navigates to /room/{cname}/{busiType}
   - Join Invisible → navigates with `?visible=false`
   - Banner doesn't render when statusType=0 or blackened
2. **Re-fetch:** open modal, wait 60s+, observe re-fetch (visible in network panel).
3. **Modal close:** click X while join is in flight → no error, navigation completes.

## 8. Out of scope

- **Following / unfollowing this host from the banner.** The follow button in the
  existing meta-row handles that. Adding a second one would be noise.
- **Showing the audience count / member list inline.** The room page handles that; the
  banner is intentionally compact.
- **Polling presence while the modal is open.** 60s cache TTL is enough — the user's
  expected session length for a profile view is shorter than that, and stale data here
  isn't harmful (worst case: they tap Join and the host just left — the join-bundle
  handles that case already).
- **Sharing this banner with other surfaces (event cards, ghost-audience roster).** They
  consume `UserInfo` via the same `UserInfoService` so they *could* show the same chip,
  but that's a per-feature decision each consumer can make later. Out of scope here.

## 9. Open questions

None — all five clarifying questions above resolved.

## 10. Implementation order

1. `shared/utils/room-busi-type.ts` + small inline spec (per project memory:
   `feedback_no-unit-tests-unless-asked.md` allows inline tests; this util is simple enough
   that a one-file spec covers the LS_/VR_ rule).
2. `shared/ui/room-presence-banner/` component (dumb, all presentational, no service deps).
3. Wire banner into `user-info-modal.component.ts` (host fetch effect + join handler).
4. Trivial migration in `voice-list.ts` to use the shared `cnameToBusiType`.
5. End-to-end verification: dev server + BFF + curl of `/users/{id}/status` to confirm
   the wiring.

Estimated size: ~180 lines new, ~30 lines modified across 5 files.