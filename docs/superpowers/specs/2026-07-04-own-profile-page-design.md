# Own Profile Page — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Supersedes:** `docs/superpowers/specs/2026-06-21-profile-page-full-design.md` and its paired implementation plan. That spec was written at project bootstrap and never acted on (`features/profile/` is still the original stub — `ProfilePageComponent`'s template literally says "profile page well be implimented later"). It's also stale in two ways this spec fixes: (1) it proposes `/profile` + `/profile/:userId` two-route scope covering other users' profiles too — out of scope here, the existing `UserInfoModalComponent` already handles viewing other users well; (2) it lists `stats`/`visitors`/`edit`/`limitations` as "BFF changes needed" — all of these, plus a bundle endpoint it didn't know about, were already implemented and live-tested against the real HelloTalk API in a prior session. Do not resurrect the old spec's two-route or edit-sheet scope without a fresh design conversation.

**Goal:** A polished, read-only page at `/profile` for viewing your own account — identity, stats, and tabbed access to your Followers, Following, Profile Visitors, and Blocked Users — matching the app's existing design system and the visual language already established in `UserInfoModalComponent`.

**Explicitly out of scope for this spec:** editing any profile field (no confirmed-safe field names beyond birthday/learn_lang2/teach_lang2 — see gap 6 in `profile_endpoints.md`), viewing other users' full profile pages (the modal already covers this), follow/unfollow actions on this page (you can't follow yourself).

---

## Backend contract (already built and live-tested — not new work)

All of this exists in `jilalibff` today, commit `f896351`, and was verified with curl against the real upstream API in the same session it was built:

| BFF endpoint | Purpose | Verified |
|---|---|---|
| `GET /api/profile/{userId}/bundle` | Main load: `userInfo` (full profile — base info, tags, languages, points, relation counts, privacy flags) + `stats` (own moments) + `limitations` (edit permissions, unused by this page but free since the bundle already fetches it) when `isOwnProfile` | ✅ curl-tested live, self branch |
| `GET /api/profile/followers?pageIndex=&pageSize=` | Paginated followers list, cursor-based (`page_index`/`more`) | ✅ |
| `GET /api/profile/following?focusTab=&pageSize=&title=` | Paginated following list, same cursor shape, supports name search via `title` | ✅ |
| `POST /api/profile/visitors` | Paginated "who viewed my profile" — body includes `sign` (see Risk below) | ⚠️ not yet tested — see Risk |
| `GET /api/profile/blocklist` | Blocked users list — every real capture returned it empty; write endpoints (block/unblock) don't exist anywhere in `profile_endpoints.md`'s research | ✅ (confirmed empty-shape) |

Response envelope: bundle/followers/following/blocklist all return their payload directly (Micronaut Serde, camelCase JSON, e.g. `{"userInfo": {...}, "isOwnProfile": true, "stats": {...}, "limitations": {...}}` for the bundle — see the live curl output captured earlier this session for the exact shape). No client-side envelope unwrapping needed; the BFF already strips upstream's `code`/`status` wrapper for these four.

### Risk: Visitors tab's `sign` field

`POST /api/profile/visitors` forwards a `VisitorHistoryRequest` with a `sign` field to upstream. Nothing in `profile_endpoints.md`'s research ever reverse-engineered how that signature is derived — it's unconfirmed whether upstream validates it strictly. This was never live-tested. Build the tab the same way as the others; if upstream rejects the call, it surfaces as a normal tab-level error state (retry button), not a page crash. Confirm/fix live the same way the `x-ht-uid` bug was found — don't block the rest of the page on it.

---

## Frontend architecture

```
features/profile/
├── data-access/
│   └── profile-api.ts              # HTTP calls to the four endpoints above
├── models/
│   └── profile.model.ts            # Bundle/UserInfo/list-item/tab-page interfaces
├── store/
│   └── profile.store.ts            # Component-provided (CLAUDE.md §7 — view-scoped, not root)
├── ui/
│   ├── profile-header.ts           # Identity card: avatar, name, VIP, bio, tags, languages
│   ├── profile-stats-bar.ts        # Followers/Following/Moments/Likes — tap switches tabs
│   ├── user-list-item.ts           # One row: avatar, name, flag, VIP badge — shared by 3 tabs
│   └── blocked-list.ts             # Blocked Users tab content
├── pages/
│   └── profile-page.component.ts   # Smart page: tab switching, renders sections
└── index.ts
```

`profile.model.ts` mirrors the BFF's camelCase JSON directly — no snake_case anywhere on the frontend, since the BFF already normalizes it (confirmed via the live curl responses: `userInfo.nickname`, `details.base.headUrl`, `details.relation.followers`, etc.).

`ProfileStore` is `@Injectable()` (bare, component-provided in `ProfilePageComponent`'s `providers: []`) — matches `MessagesStore`'s pattern, not `providedIn: 'root'`, since this is single-page view state with no cross-route persistence need.

---

## Routing

No changes. `app.routes.ts` already has `{ path: 'profile', loadComponent: () => import('./features/profile').then((m) => m.ProfilePageComponent) }` pointing at this feature's `index.ts`. This spec fills in what that component renders; it doesn't touch route config.

---

## Data flow

1. `ProfilePageComponent` provides `ProfileStore`, which reads the current user id from `AuthStore` and creates an `rxResource` calling `profileApi.bundle(selfId)`. This is the ONLY eager fetch on page load.
2. Followers / Following / Visitors / Blocked each get their own `rxResource` inside `ProfileStore`, gated behind a `params` function that returns `undefined` until that tab has been activated at least once (same lazy-resource pattern already used in `SigninStore` for `EMPTY_REWARDS`/`EMPTY_LEVEL_CONFIG` defaults) — switching to "Followers" for the first time triggers the fetch; switching back to it later does not re-fetch.
3. Each list tab shows a "Load more" button when `more: true`, calling the same `rxResource` with an updated cursor param (`pageIndex` for followers/following, `index` for visitors) rather than infinite scroll — simpler, no scroll-listener plumbing, consistent with a v1 scope.
4. No writes happen anywhere on this page (view-only). No optimistic updates, no toasts on success — only error states on fetch failure.

---

## Visual design

### Identity card (`profile-header.ts`)

Reuses the exact visual language from `UserInfoModalComponent`'s `.identity-card` (avatar with VIP-gold ring when `vipType === 100`, gender badge, meta chips for VIP/online/streak, bio truncated to 2 lines, tag chips, language chips with native + "also learning" languages) scaled up for a full page:
- Larger avatar (`size="xl"` on `AvatarComponent`, using its existing `src`/`initials`/`status`/`ringColor`/`crownType` inputs — no new avatar variant needed).
- `CountryFlagComponent` for nationality, `LanguageTagComponent` for native/learning languages — reused as-is.
- Two-column layout on desktop via a `@container` query (matching `room-page.ts`'s `@container room-page (min-width: ...)` breakpoint pattern) — avatar + name/meta on the left, bio + tags + languages on the right. Single column, stacked, on mobile.
- "Member for {{ regDays }}d" and location line reuse the modal's exact copy/format.

### Stats bar (`profile-stats-bar.ts`)

Four stat cells (Followers / Following / Moments / Likes) from `details.relation.*` and `stats.totalMntCount`/`totalLikeCount`. Tapping a cell switches the active tab below (Followers cell → Followers tab, Following cell → Following tab; Moments/Likes cells are not tabs — own moments browsing is out of scope, they're informational only).

### Tabs (`profile-page.component.ts`)

`@angular/aria/tabs` (`Tabs`, `TabList`, `Tab`, `TabPanel`), styled with the same pill-tab-bar tokens already established in `comments-panel.ts` (`--cp-tab-bg`, `--cp-tab-active-bg`, etc. — renamed to a profile-local token prefix, same values). Four tabs: Followers, Following, Visitors, Blocked.

### List rows (`user-list-item.ts`)

One reusable row component for Followers/Following/Visitors (Blocked has its own simpler row — see below): `AvatarComponent` (`size="md"`), name, `CountryFlagComponent`, VIP chip if `vipType > 0`, and a `variant: 'followers' | 'following' | 'visitors'` input controlling the trailing content — mutual/"Following" badge for `following`, relative visit time + visit count for `visitors`, nothing extra for `followers`. A single typed input, not `ng-content`, keeps the row's rendering logic in one place and testable without a host wrapper.

### Blocked Users tab (`blocked-list.ts`)

Given every capture returned an empty blocklist and no add/remove endpoint exists, this tab is realistically going to show its empty state for nearly every real account. Built the same as the others (list + empty state), but don't invest in interaction affordances (swipe-to-unblock, etc.) that have no backend to call — the empty state carries the UX here.

---

## States

- **Loading:** skeleton shimmer for the identity card (reusing `.skeleton-chip`'s shimmer keyframe from the modal); simple row-shaped skeletons (avatar circle + two text bars) for list tabs, 3-4 repeated.
- **Empty:** reuses the modal's `.empty-state`/`.empty-text` pattern — e.g. "No followers yet", "No visitors yet", "No blocked users".
- **Error:** inline retry button within the failed section only (identity card OR the active tab) — never a full-page error, per CLAUDE.md §12 ("a failing background call must never eject the user to a full-page error while the app is otherwise working"). The bundle fetch failing is the one exception that should show a page-level error+retry, since without it there's nothing to render at all.

---

## Testing

- Manual verification against the live BFF (already running, already proven reachable) for: bundle load, followers pagination, following pagination + search, visitors (expect to discover whether `sign` blocks it), blocklist empty state, tab switching lazy-fetch behavior (confirm switching to a tab twice only fires one HTTP call).
- No backend changes anticipated: this spec is purely additive on the frontend against an already-complete, already-tested BFF surface.
