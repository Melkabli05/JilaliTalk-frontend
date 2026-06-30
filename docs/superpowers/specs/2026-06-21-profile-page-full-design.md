# Full Profile Feature — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full profile experience for viewing any user's social graph and managing your own profile — followers, following, visitors, stats, and profile editing.

**Architecture:** Two-route Angular feature (`/profile` for own, `/profile/:userId` for others) backed by a BFF proxy that routes to multiple HelloTalk API endpoint groups. Facade-per-domain Angular services isolate each data domain.

**Tech Stack:** Angular 22 signals + OnPush, CDK Dialog (edit sheet), Micronaut BFF with `@Client` interfaces, forkJoin for parallel fetches.

---

## Global Constraints

- `exactOptionalPropertyTypes` — optional fields use `field?: T` not `field: T | undefined`
- `noUncheckedIndexedAccess` — array indexing needs `?? fallback`
- Angular signals: `signal()`, `computed()`, `effect()` — no RxJS Subjects for UI state
- BFF: profile endpoints use `status`/`message` envelope; `/profile/v2/*` uses `code`/`msg`
- All API calls go through BFF (`/api/profile/*`), not directly to HelloTalk

---

## Page Structure

### Route 1: `/profile` — Own Profile

Full access: all tabs + edit button + stats.

### Route 2: `/profile/:userId` — Other User's Profile

Read-only social view. No Stats tab, no Edit button. Shows Follow/Following action button instead.

---

## API Endpoints (BFF → HelloTalk)

All BFF endpoints live under `/api/profile`. Two upstream bases:

| Upstream base | Endpoints |
|---|---|
| `https://api-global.hellotalk8.com/` (root, `ProfileClient`) | `/profile/v2/me`, `/profile/v2/increment`, `/profile/v1/baseinfo/mnt_info`, `/relation/followers`, `/relation/followings`, `/relation/follow`, `/user_profile_visitor/v1/visit`, `/user_profile_visitor/v2/profile_liker_count`, `/user_profile_visitor/v2/my_history`, `/go_user_search/v1/go_user_info/get_user_langs` |
| `https://api-global.hellotalk8.com/livehub/` (`JilaliClient`) | Any existing room/stage/comment endpoints |

### Existing (already wired)

| BFF | HelloTalk | Method | Response |
|---|---|---|---|
| `GET /api/profile/me` | `/profile/v2/me` | POST | `{"code":0,"msg":"ok","data":{"increment":{...},"visitor":{...}}}` |
| `GET /api/profile/followers` | `/relation/followers` | GET | `{"status":0,"message":"success","data":{"page_index":"...","more":true,"count":N,"pinned_stat":{...},"list":[...]}}` |
| `GET /api/profile/following` | `/relation/followings` | GET | same envelope as followers |
| `POST /api/profile/follow` | `/relation/follow` | POST | `{"status":0,"message":"success","data":{"list_timestamp":...,"status":1,...}}` |
| `POST /api/profile/visit` | `/user_profile_visitor/v1/visit` | POST | 200 (skip — not used) |
| `GET /api/profile/like-count` | `/user_profile_visitor/v2/profile_liker_count` | GET | `{"status":0,"message":"success","data":{"unread_favor_count":0,"unread_favor_people":0}}` |
| `GET /api/profile/langs` | `/go_user_search/v1/go_user_info/get_user_langs` | GET | `{"code":0,"msg":"success","data":[{"lang":1,"is_temp":0,"is_expired_vip_self_set_lang":0}]}` |

### New BFF endpoints to add

| BFF | HelloTalk | Method | Response | Purpose |
|---|---|---|---|---|
| `POST /api/profile/stats` | `/profile/v1/baseinfo/mnt_info` | POST | `{"status":0,"message":"","data":{"total_mnt_count":20,"total_like_count":582,"last_mnt_like_count":14,"last_mnt_post_ts":1767213763,"registered_ts":1702769476}}` | Own profile lifetime stats |
| `POST /api/profile/visitors` | `/user_profile_visitor/v2/my_history` | POST | `{"msg":"success","data":{"index":1,"more":true,"list":[{"userid":...,"nickname":...,"visit_ts":...,"visit_cnt":1,...}]}}` | Paginated visitor list |
| `POST /api/profile/edit` | `/profile/v1/modify_baseinfo` | POST | `{"status":0,"msg":"OK"}` | Edit own profile fields |
| `GET /api/profile/user/:userId` | (derive from existing) | — | — | Public user card (from followings/followers list items — no separate call needed) |

---

## Data Models

### `ProfileMeResponse` (existing — correct)
```ts
interface ProfileMe {
  code: number;
  msg: string;
  data: {
    increment: {
      newFollowerCount: number;
      newVisitorCount: number;
      newProfileLikeCount: number;
      newProfileLikePeople: number;
      newVisitorInfos: VisitorInfo[] | null;
    } | null;
    visitor: { recentVisitors: VisitorInfo[] | null } | null;
  } | null;
}
```

### `FollowerUser` (fixed — sex is `number`, not `string`)
```ts
interface FollowerUser {
  userId: number;
  sex: number;           // 0=female, 1=male
  nationality: string | null;
  headUrl: string | null;
  nickName: string | null;
  nativeLang: number | null;
  vipType: number | null;
  giftLevel: number;
  remarkName: string | null;
  isMutual: boolean;
  // Additional fields from upstream (present but not all displayed):
  isPinned: boolean;
  isSpecialFocus: boolean;
  vipExpireTime: number;
  fullCountry: string;
  cityName: string;
}
```

### `FollowersPage` / `FollowingPage` (correct)
```ts
interface FollowersPage {
  status: number;
  message: string;
  data: {
    pageIndex: string;
    more: boolean;
    count: number;
    pinnedStat: { limit: number; cnt: number } | null;
    list: FollowerUser[];
  } | null;
}
```

### `ProfileStats` (new — from `/profile/v1/baseinfo/mnt_info`)
```ts
interface ProfileStatsResponse {
  status: number;
  message: string;
  data: {
    totalMntCount: number;       // lifetime moments posted
    totalLikeCount: number;      // lifetime likes received
    lastMntLikeCount: number;    // likes on last moment
    lastMntPostTs: number;       // unix timestamp of last post
    registeredTs: number;        // account creation timestamp
  } | null;
}
```

### `VisitorUser` (new — from `/user_profile_visitor/v2/my_history`)
```ts
interface VisitorUser {
  userid: number;
  username: string;
  nickname: string;
  nationality: string;
  headUrl: string;
  birthday: string | null;
  sex: number;
  nativeLang: number;
  visitTs: number;        // unix timestamp of last visit
  visitCnt: number;       // number of visits
  isSecretVisit: boolean;
  distance: number;
  vipLogo: string;
  hwVip: boolean;
  englishAiVip: boolean;
  languageAiVip: boolean;
  roomStatus: number;
  giftLevel: number;
}
```

### `VisitorsPage` (new)
```ts
interface VisitorsPage {
  msg: string;
  data: {
    index: number;       // next cursor (pass as `index` in request)
    more: boolean;
    list: VisitorUser[];
  } | null;
}
```

### `ProfileEditRequest` (new)
```ts
interface ProfileEditRequest {
  birthday?: string;       // "YYYY-MM-DD"
  nationality?: string;    // 2-letter country code e.g. "MA"
  osType?: number;         // 0=iOS, 1=Android
  version?: string;        // app version e.g. "6.2.0"
}
```

---

## Angular Feature Structure

```
features/profile/
├── models/
│   └── profile.model.ts          # All interfaces above (updated)
├── data-access/
│   ├── profile-api.ts            # HTTP calls — add stats() and visitors()
│   ├── followers.service.ts      # Existing, fix data.path accessor
│   ├── following.service.ts      # Existing, fix data.path accessor
│   ├── visitors.service.ts       # NEW — wraps POST /profile/visitors
│   └── profile-stats.service.ts  # NEW — wraps POST /profile/stats
├── store/
│   └── profile.store.ts          # Own profile state (tabs, loading, data)
├── pages/
│   └── profile-page.component.ts # Main page — tabs, header, stats
└── ui/
    ├── profile-header.ts         # NEW — avatar, name, action button
    ├── stats-bar.ts              # NEW — lifetime + delta stats row
    ├── follower-list.ts          # NEW — paginated follower grid
    ├── following-list.ts         # NEW — paginated following grid
    ├── visitor-list.ts           # NEW — paginated visitor list
    ├── stats-tab.ts              # NEW — own profile stats tab
    ├── edit-profile-sheet.ts     # NEW — CDK Dialog bottom sheet for editing
    └── index.ts
```

**Store vs Service distinction:** `ProfileStore` is component-provided (not `providedIn: root`) — it owns the own-profile page state. Each tab's data service (`FollowersService`, `VisitorsService`, etc.) is `providedIn: root` so multiple components can share the same list when navigating between profiles.

---

## Page Layout

### Own Profile (`/profile`)

```
┌──────────────────────────────────┐
│  [Avatar]  Nickname              │  ← profile-header
│           @username              │
│           [Edit Profile]         │
├──────────────────────────────────┤
│  Followers   Following   Likes   │  ← stats row (lifetime + delta)
│    760(+4)    306(+0)    582     │
├──────────────────────────────────┤
│  [Followers] [Following] [Visitors] [Stats] │  ← tab bar
├──────────────────────────────────┤
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐    │
│  │ 👤 │ │ 👤 │ │ 👤 │ │ 👤 │    │  ← follower-list (grid)
│  └────┘ └────┘ └────┘ └────┘    │
│  [Load more]                     │
└──────────────────────────────────┘
```

### Other User (`/profile/:userId`)

```
┌──────────────────────────────────┐
│  [Avatar]  Nickname              │
│           @username              │
│           [Follow] or [Following]│  ← action button
├──────────────────────────────────┤
│  Followers   Following           │  ← stats row (no likes for others)
│    760        306                │
├──────────────────────────────────┤
│  [Followers] [Following] [Visitors] │  ← no Stats tab
└──────────────────────────────────┘
```

---

## Tab Content

### Followers Tab
- Grid of `FollowerUser` cards (avatar, name, mutual badge)
- Search bar at top (filters by `nickName`)
- Infinite scroll (cursor pagination via `page_index`)
- Pull-to-refresh
- Tap card → navigate to `/profile/:userId`

### Following Tab
- Same grid as followers
- Search bar (filters by `nickName`)
- Shows "Following" badge for `isMutual=true`, "Follow back" for false
- Long-press → options (unfollow — future)

### Visitors Tab (own profile only)
- List of `VisitorUser` cards (avatar, name, "visited N times", relative time)
- Infinite scroll via `index` cursor
- `isSecretVisit` users shown with a lock icon (don't expose their identity)
- Empty state: "No visitors yet"

### Stats Tab (own profile only)
- `totalMntCount` — "X moments posted"
- `totalLikeCount` — "X likes received"
- `lastMntLikeCount` — "X likes on your last moment"
- `registeredTs` → formatted "Member since Jan 2024"
- `lastMntPostTs` → formatted "Last posted 3 days ago" or "Never posted"

---

## Edit Profile Sheet (CDK Dialog bottom sheet)

Fields:
- **Birthday** — date picker input, `YYYY-MM-DD` format
- **Nationality** — select dropdown (country list)
- **Display Name / Nickname** — text input (may come from separate endpoint)

On submit: `POST /api/profile/edit` with form values. On success: close sheet + toast "Profile updated". On error: inline error message, keep sheet open.

---

## Routing

```ts
{
  path: 'profile',
  children: [
    { path: '',           component: ProfilePage, title: 'My Profile' },
    { path: ':userId',    component: ProfilePage, title: 'Profile' },
  ]
}
```

`ProfilePage` reads `route.paramMap.get('userId')`. If `null` → own profile. If set → other user's profile.

---

## BFF Changes Needed

### New `ProfileClient` methods (add to existing interface)

```java
// stats — lifetime moment/like counts
@Post("/profile/v1/baseinfo/mnt_info")
ProfileStatsResponse stats(@Body Map<String, Object> body);

// visitors — paginated visitor list
@Post("/user_profile_visitor/v2/my_history")
VisitorsResponse visitors(@Body VisitorHistoryBody body);

// edit profile
@Post("/profile/v1/modify_baseinfo")
ProfileEditResponse editProfile(@Body ProfileEditBody body);
```

### New DTOs needed

- `ProfileStatsResponse` — `status`, `message`, `data` with `totalMntCount`, `totalLikeCount`, etc.
- `VisitorHistoryBody` — `deviceType`, `clientTs`, `index`, `deviceId`, `sign`, `clientVer`, `updateTs`, `clientOs`
- `VisitorsResponse` — `msg`, `data` with `index`, `more`, `list` of visitor records
- `ProfileEditBody` — `birthday`, `osType`, `version`
- `ProfileEditResponse` — `status`, `msg`

---

## Open Questions (resolved in design)

1. **Own vs other profile** → Two routes sharing one `ProfilePageComponent`, conditional rendering via `userId` param
2. **Stats display** → Lifetime counts + delta badges (Option C)
3. **Visit recording** → Not wired — skip
4. **Editing** → Full edit (birthday, nationality) via bottom sheet, no limitation handling
5. **Edit UI** → Bottom sheet (CDK Dialog)
6. **Visitors tab** → Only on own profile, hidden for others
7. **Stats tab** → Only on own profile, hidden for others