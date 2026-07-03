# Own Profile Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished, read-only `/profile` page — identity card, stats, and tabbed Followers/Following/Visitors/Blocked-Users lists — for the currently logged-in user, backed entirely by the already-built and live-tested BFF endpoints.

**Architecture:** One Angular feature (`features/profile/`) with a component-provided `ProfileStore` driving five `rxResource`s (one eager bundle load, four lazy tab loads gated by "has this tab been opened yet" signals — the exact pattern already used in `SigninStore`). Presentation is four small shared-shape components (`profile-header`, `profile-stats-bar`, `user-list-item`, `blocked-list`) composed by one smart page component using `@angular/aria/tabs` (already used in `comments-panel.ts`).

**Tech Stack:** Angular 22 signals + `rxResource`, `@angular/aria/tabs`, HttpClient, Vitest.

## Global Constraints

- `exactOptionalPropertyTypes` is on — this plan follows the existing codebase convention of `readonly field: T | null` (not `field?: T`) for nullable API fields, matching every existing model in `user-info.service.ts` and `room-model.ts`.
- `noUncheckedIndexedAccess` is on — any array indexing needs `?? fallback` or an explicit length check first.
- Zero manual `.subscribe()` calls anywhere — use `rxResource` (see CLAUDE.md §8). The one exception already established in this codebase is a `firstValueFrom` inside an `async` method for a one-shot imperative call (see `UserInfoModalComponent.toggleFollow`) — this plan has no such calls, everything here is a read.
- Every component: `ChangeDetectionStrategy.OnPush`, no redundant `standalone: true`.
- No hardcoded colors — every style value is a `var(--...)` token.
- `ProfileStore` must be `@Injectable()` (bare, component-provided), never `providedIn: 'root'` — it's view-scoped state, per CLAUDE.md §7.
- No backend changes in this plan. Every endpoint used here already exists in `jilalibff` and was live-curl-tested in the prior session (see `profile_endpoints.md` and the design spec's "Backend contract" section for exact shapes).

---

## File Structure

```
shared/utils/
├── relative-time.util.ts           # NEW — extracted from messages-page.ts
└── relative-time.util.spec.ts      # NEW

features/profile/
├── models/
│   └── profile.model.ts            # NEW — bundle/stats/limitations/list-item/page types
├── data-access/
│   └── profile-api.ts              # NEW — HTTP calls to the 4 BFF endpoints
├── store/
│   └── profile.store.ts            # REPLACE stub — bundle + 4 lazy tab resources
├── ui/
│   ├── user-list-item.ts           # NEW — shared row for followers/following/visitors
│   ├── profile-header.ts           # NEW — identity card
│   ├── profile-stats-bar.ts        # NEW — 4-stat row, tap switches tab
│   └── blocked-list.ts             # NEW — blocked users tab content
├── pages/
│   └── profile-page.component.ts   # REPLACE stub — wires everything
└── index.ts                        # unchanged (already exports ProfilePageComponent)
```

---

### Task 1: Extract relative-time formatting into a shared util (TDD)

`messages-page.ts` has a private `relativeTime(ts: number): string` method (returns "now"/"5m"/"3h"/"Yesterday"/"Jun 12"/"Jun 12 '24"). The Visitors tab needs the exact same formatting for `visitTs`. Extract it to `shared/utils` so both features use one implementation instead of two copies drifting apart.

**Files:**
- Create: `src/app/shared/utils/relative-time.util.ts`
- Create: `src/app/shared/utils/relative-time.util.spec.ts`
- Modify: `src/app/shared/utils/index.ts`
- Modify: `src/app/features/messages/pages/messages-page.ts:970-984` (delete the private method, use the import)

**Interfaces:**
- Produces: `relativeTime(ts: number): string` — importable from `@shared/utils`

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/shared/utils/relative-time.util.spec.ts
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { relativeTime } from './relative-time.util';

describe('relativeTime', () => {
  const NOW = new Date('2026-07-04T12:00:00.000Z').getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "now" for under a minute ago', () => {
    expect(relativeTime(NOW - 30_000)).toBe('now');
  });

  it('returns minutes for under an hour ago', () => {
    expect(relativeTime(NOW - 5 * 60_000)).toBe('5m');
  });

  it('returns hours for under a day ago', () => {
    expect(relativeTime(NOW - 3 * 60 * 60_000)).toBe('3h');
  });

  it('returns "Yesterday" for 24-48 hours ago', () => {
    expect(relativeTime(NOW - 30 * 60 * 60_000)).toBe('Yesterday');
  });

  it('returns month/day for older-than-48h same-year timestamps', () => {
    const ts = new Date('2026-06-12T12:00:00.000Z').getTime();
    expect(relativeTime(ts)).toBe('Jun 12');
  });

  it('returns month/day/2-digit-year for timestamps from a previous year', () => {
    const ts = new Date('2024-06-12T12:00:00.000Z').getTime();
    expect(relativeTime(ts)).toBe('Jun 12, 24');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/mohammed/Desktop/JilaliTalk/JilaliTalk-angular-frontend && npx vitest run src/app/shared/utils/relative-time.util.spec.ts`
Expected: FAIL — `Cannot find module './relative-time.util'`

- [ ] **Step 3: Write the implementation**

```typescript
// src/app/shared/utils/relative-time.util.ts
/** Formats a unix-ms timestamp as a short relative string: "now", "5m", "3h", "Yesterday",
 *  or a month/day (with a 2-digit year suffix once it's from a previous calendar year). */
export function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  if (hrs < 48) return 'Yesterday';
  const d = new Date(ts);
  const now = new Date();
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/shared/utils/relative-time.util.spec.ts`
Expected: PASS, 6/6 tests. If the "previous year" test's exact string differs from your Node locale's `toLocaleDateString` output, adjust the test's expected string to match what your environment actually produces (the implementation is correct either way — this is a locale-formatting nuance, not a logic bug) rather than change the implementation.

- [ ] **Step 5: Add the barrel export**

```typescript
// src/app/shared/utils/index.ts
export { CollectionStore } from './collection-store';
export { EnrichBatchQueue } from './enrich-batch-queue';
export { normalizeForSearch, createSearchMatcher, initialsFrom, formatClockTime } from './text-search.util';
export * from './http-error-message.util';
export { relativeTime } from './relative-time.util';
```

- [ ] **Step 6: Refactor messages-page.ts to use the shared util instead of its own copy**

In `src/app/features/messages/pages/messages-page.ts`, add the import near the top:

```typescript
import { relativeTime } from '@shared/utils';
```

Delete the private method (lines ~970-984):

```typescript
  protected relativeTime(ts: number): string {
    const diff = Date.now() - ts;
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return 'now';
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    if (hrs < 48) return 'Yesterday';
    const d = new Date(ts);
    const now = new Date();
    if (d.getFullYear() === now.getFullYear()) {
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' });
  }
```

The template already calls `{{ relativeTime(conv.lastTs) }}` — since the free function is now imported at module scope (not a class member), Angular templates can't call it directly as a bare identifier. Add a one-line protected wrapper in the class instead of leaving the template broken:

```typescript
  protected relativeTime(ts: number): string {
    return relativeTime(ts);
  }
```

(Yes, this looks redundant — it's a thin bridge from "free function" to "something the template can bind to". This is the smallest change that keeps the template untouched. If you prefer, rename the import via `import { relativeTime as formatRelativeTime } from '@shared/utils'` and update both the wrapper and the two template call sites to `formatRelativeTime` — either is fine, pick one and be consistent.)

- [ ] **Step 7: Run the full test suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit -p tsconfig.app.json`
Expected: all existing tests still pass, no new type errors.

- [ ] **Step 8: Commit**

```bash
git add src/app/shared/utils/relative-time.util.ts src/app/shared/utils/relative-time.util.spec.ts src/app/shared/utils/index.ts src/app/features/messages/pages/messages-page.ts
git commit -m "refactor: extract relativeTime into shared/utils, reuse in messages-page"
```

---

### Task 2: Profile feature models

**Files:**
- Create: `src/app/features/profile/models/profile.model.ts`

**Interfaces:**
- Consumes: `UserInfo` from `@core/services/user-info.service.ts` (existing, unchanged — reused verbatim for the bundle's `userInfo` field, do not redefine it)
- Produces: `ProfileBundleResponse`, `ProfileStats`, `ProfileLimitations`, `SocialUser`, `SocialListPage`, `VisitorUser`, `VisitorsPage`, `BlockedUser`, `BlockListPage` — all imported by Tasks 3-9

- [ ] **Step 1: Write the models file**

```typescript
// src/app/features/profile/models/profile.model.ts
import { UserInfo } from '@core/services/user-info.service';

// ── Bundle (GET /api/profile/{userId}/bundle) — unwrapped, no envelope ────────────

export interface ProfileStats {
  readonly totalMntCount: number | null;
  readonly totalLikeCount: number | null;
  readonly lastMntLikeCount: number | null;
  readonly lastMntPostTs: number | null;
  readonly registeredTs: number | null;
}

export interface ProfileTagLimit {
  readonly hobbyLmit: number | null;
  readonly travellingLmit: number | null;
  readonly hometownLmit: number | null;
  readonly educationLmit: number | null;
  readonly occupationLmit: number | null;
  readonly mbtiLmit: number | null;
  readonly zodiacSignLimit: number | null;
  readonly bloodTypeLimit: number | null;
}

export interface ProfileLangLimit {
  readonly limitDays: number | null;
  readonly nextModifyTs: number | null;
}

/** Edit-permission flags. Fetched by the bundle but unused by this (view-only) page —
 *  kept fully typed for the eventual edit feature rather than typed as `unknown`. */
export interface ProfileLimitations {
  readonly tagLimit: ProfileTagLimit | null;
  readonly langLimit: ProfileLangLimit | null;
  readonly modifyNationality: boolean;
  readonly modifyGender: boolean;
  readonly modifyBirthday: boolean;
  readonly modifyBirthdayByAdmin: boolean;
  readonly isModifyRestricted: boolean;
}

/** Response of `GET /api/profile/{userId}/bundle`. `stats`/`limitations` are present only
 *  when `isOwnProfile` is true; `payChatInfo`/`reminderMoment` only when it's false. This
 *  page always requests its own id, so it only ever reads `userInfo`, `isOwnProfile` (always
 *  true here, but checked defensively), and `stats`. */
export interface ProfileBundleResponse {
  readonly userInfo: UserInfo;
  readonly isOwnProfile: boolean;
  readonly stats: ProfileStats | null;
  readonly limitations: ProfileLimitations | null;
}

// ── Followers / Following (GET /api/profile/followers|following) — status/message/data envelope

/** One row in a followers or following list. Field set mirrors jilalibff's
 *  `FollowersResponse.FollowerUser` — only fields both endpoints actually populate. */
export interface SocialUser {
  readonly userId: number;
  readonly sex: number | null;
  readonly nationality: string | null;
  readonly headUrl: string | null;
  readonly nickName: string | null;
  readonly nativeLang: number | null;
  readonly vipType: number | null;
  readonly giftLevel: number | null;
  readonly remarkName: string | null;
  readonly isMutual: boolean;
}

export interface SocialListPage {
  readonly pageIndex: string | null;
  readonly more: boolean;
  readonly count: number;
  readonly list: readonly SocialUser[];
}

/** Raw envelope shape before unwrapping — `profile-api.ts` strips this down to
 *  `SocialListPage` before returning to callers. */
export interface SocialListEnvelope {
  readonly status: number;
  readonly message: string | null;
  readonly data: SocialListPage | null;
}

// ── Visitors (POST /api/profile/visitors) — msg/data envelope, no top-level status ─────

export interface VisitorUser {
  readonly userid: number;
  readonly username: string | null;
  readonly nickname: string | null;
  readonly nationality: string | null;
  readonly headUrl: string | null;
  readonly sex: number | null;
  readonly visitTs: number | null;
  readonly visitCnt: number | null;
  readonly isSecretVisit: boolean;
  readonly vipLogo: string | null;
  readonly giftLevel: number | null;
}

export interface VisitorsPage {
  readonly index: number | null;
  readonly more: boolean;
  readonly list: readonly VisitorUser[];
}

export interface VisitorsEnvelope {
  readonly msg: string | null;
  readonly data: VisitorsPage | null;
}

// ── Blocked users (GET /api/profile/blocklist) — code/msg/data envelope ────────────────

/** Shape is unconfirmed — every real capture returned an empty list (see
 *  profile_endpoints.md gap #3). Kept minimal and defensive on purpose. */
export interface BlockedUser {
  readonly userId: number | null;
  readonly nickName: string | null;
  readonly headUrl: string | null;
}

export interface BlockListEnvelope {
  readonly code: number;
  readonly msg: string | null;
  readonly data: { readonly blackList: readonly BlockedUser[] | null } | null;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors (this file has no logic to test, just types — no unit test needed for a pure interface file, consistent with how `room-model.ts` has no `.spec.ts`).

- [ ] **Step 3: Commit**

```bash
git add src/app/features/profile/models/profile.model.ts
git commit -m "feat(profile): add data models for bundle, social lists, visitors, blocklist"
```

---

### Task 3: ProfileApi data-access

**Files:**
- Create: `src/app/features/profile/data-access/profile-api.ts`

**Interfaces:**
- Consumes: `API_BASE_URL` from `@core/tokens/api-base-url.token` (existing); all types from Task 2
- Produces: `ProfileApi` class with `bundle(userId)`, `followers(pageIndex, pageSize)`, `following(pageSize, title)`, `visitors(index)`, `blocklist()` — all `Observable<...>`, consumed by Task 4

- [ ] **Step 1: Write the file**

```typescript
// src/app/features/profile/data-access/profile-api.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '@core/tokens/api-base-url.token';
import {
  ProfileBundleResponse,
  SocialListEnvelope,
  SocialListPage,
  VisitorsEnvelope,
  VisitorsPage,
  BlockListEnvelope,
  BlockedUser,
} from '../models/profile.model';

const EMPTY_SOCIAL_PAGE: SocialListPage = { pageIndex: null, more: false, count: 0, list: [] };
const EMPTY_VISITORS_PAGE: VisitorsPage = { index: null, more: false, list: [] };

@Injectable({ providedIn: 'root' })
export class ProfileApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(API_BASE_URL)}/profile`;

  /** GET /api/profile/{userId}/bundle — unwrapped, no envelope to strip. */
  bundle(userId: number): Observable<ProfileBundleResponse> {
    return this.http.get<ProfileBundleResponse>(`${this.baseUrl}/${userId}/bundle`);
  }

  /** GET /api/profile/followers — cursor-paginated, status/message/data envelope. */
  followers(pageIndex: string, pageSize: number): Observable<SocialListPage> {
    const params = new HttpParams().set('pageIndex', pageIndex).set('pageSize', pageSize);
    return this.http
      .get<SocialListEnvelope>(`${this.baseUrl}/followers`, { params })
      .pipe(map((res) => res.data ?? EMPTY_SOCIAL_PAGE));
  }

  /** GET /api/profile/following — same envelope as followers; `title` is a name search,
   *  empty string for the unfiltered list. */
  following(pageSize: number, title = ''): Observable<SocialListPage> {
    const params = new HttpParams()
      .set('focusTab', 0)
      .set('pageSize', pageSize)
      .set('title', title);
    return this.http
      .get<SocialListEnvelope>(`${this.baseUrl}/following`, { params })
      .pipe(map((res) => res.data ?? EMPTY_SOCIAL_PAGE));
  }

  /**
   * POST /api/profile/visitors — msg/data envelope. The `sign` field is sent blank: live
   * testing against the real BFF confirmed this returns HTTP 200 with `{"msg":"no data
   * currently"}` rather than an error (see the design spec's Risk note) — no known signature
   * algorithm exists to compute a real one, and upstream doesn't hard-reject its absence.
   */
  visitors(index: number): Observable<VisitorsPage> {
    const body = {
      device_type: 'Web',
      client_ts: Date.now(),
      index,
      device_id: 'jilalitalk-web',
      sign: '',
      client_ver: '6.3.0',
      update_ts: 0,
      client_os: 0,
    };
    return this.http
      .post<VisitorsEnvelope>(`${this.baseUrl}/visitors`, body)
      .pipe(map((res) => res.data ?? EMPTY_VISITORS_PAGE));
  }

  /** GET /api/profile/blocklist — code/msg/data envelope. Every real capture returned an
   *  empty list; this call still round-trips so the tab reflects real state if that changes. */
  blocklist(): Observable<readonly BlockedUser[]> {
    return this.http
      .get<BlockListEnvelope>(`${this.baseUrl}/blocklist`)
      .pipe(map((res) => res.data?.blackList ?? []));
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/profile/data-access/profile-api.ts
git commit -m "feat(profile): add ProfileApi data-access layer"
```

---

### Task 4: ProfileStore

**Files:**
- Modify (replace stub): `src/app/features/profile/store/profile.store.ts`

**Interfaces:**
- Consumes: `ProfileApi` (Task 3), `AuthStore` from `@core/auth/auth.store` (existing — `.user()` signal has `.userId`), all model types from Task 2
- Produces: `ProfileStore` class — `bundle`, `stats`, `userInfo`, `bundleLoading`, `bundleError` computed signals; `followers`, `following`, `visitors`, `blocked` computed signals + matching `*Loading`/`*Error`/`*More` signals (no `followingMore`-driven "load more" — see Step 1's note, Following has no cursor input on this pass); `activateFollowersTab()`, `activateFollowingTab()`, `activateVisitorsTab()`, `activateBlockedTab()`, `loadMoreFollowers()`, `loadMoreVisitors()` methods — consumed by Task 9

- [ ] **Step 1: Write the store**

```typescript
// src/app/features/profile/store/profile.store.ts
import { Injectable, inject, signal, computed } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { ProfileApi } from '../data-access/profile-api';
import { AuthStore } from '@core/auth/auth.store';
import {
  ProfileBundleResponse,
  SocialListPage,
  VisitorsPage,
  BlockedUser,
} from '../models/profile.model';

const EMPTY_SOCIAL_PAGE: SocialListPage = { pageIndex: null, more: false, count: 0, list: [] };
const EMPTY_VISITORS_PAGE: VisitorsPage = { index: null, more: false, list: [] };
const FOLLOWERS_PAGE_SIZE = 20;
const FOLLOWING_PAGE_SIZE = 20;

@Injectable()
export class ProfileStore {
  private readonly api = inject(ProfileApi);
  private readonly authStore = inject(AuthStore);

  private readonly selfId = computed(() => this.authStore.user()?.userId ?? null);

  // ── Bundle (eager — the only fetch that runs on page load) ───────────────────────

  private readonly bundleRef = rxResource<ProfileBundleResponse | null, number | undefined>({
    params: () => this.selfId() ?? undefined,
    stream: ({ params }) => (params === undefined ? of(null) : this.api.bundle(params)),
    defaultValue: null,
  });

  readonly bundle = this.bundleRef.value;
  readonly userInfo = computed(() => this.bundle()?.userInfo ?? null);
  readonly stats = computed(() => this.bundle()?.stats ?? null);
  readonly bundleLoading = this.bundleRef.isLoading;
  readonly bundleError = computed(() => (this.bundleRef.error() ? 'Failed to load your profile' : null));

  reloadBundle(): void {
    this.bundleRef.reload();
  }

  // ── Followers tab (lazy — only fetches once activateFollowersTab() has been called) ──

  private readonly _followersTabActive = signal(false);
  private readonly _followersCursor = signal<string>('');

  private readonly followersRef = rxResource<SocialListPage, { cursor: string } | undefined>({
    params: () => (this._followersTabActive() ? { cursor: this._followersCursor() } : undefined),
    stream: ({ params }) =>
      params === undefined ? of(EMPTY_SOCIAL_PAGE) : this.api.followers(params.cursor, FOLLOWERS_PAGE_SIZE),
    defaultValue: EMPTY_SOCIAL_PAGE,
  });

  readonly followers = computed(() => this.followersRef.value().list);
  readonly followersMore = computed(() => this.followersRef.value().more);
  readonly followersLoading = this.followersRef.isLoading;
  readonly followersError = computed(() => (this.followersRef.error() ? 'Failed to load followers' : null));

  activateFollowersTab(): void {
    this._followersTabActive.set(true);
  }

  loadMoreFollowers(): void {
    const next = this.followersRef.value().pageIndex;
    if (next) this._followersCursor.set(next);
  }

  // ── Following tab ──────────────────────────────────────────────────────────────

  private readonly _followingTabActive = signal(false);

  private readonly followingRef = rxResource<SocialListPage, true | undefined>({
    params: () => (this._followingTabActive() ? true : undefined),
    stream: ({ params }) =>
      params === undefined ? of(EMPTY_SOCIAL_PAGE) : this.api.following(FOLLOWING_PAGE_SIZE),
    defaultValue: EMPTY_SOCIAL_PAGE,
  });

  readonly following = computed(() => this.followingRef.value().list);
  readonly followingMore = computed(() => this.followingRef.value().more);
  readonly followingLoading = this.followingRef.isLoading;
  readonly followingError = computed(() => (this.followingRef.error() ? 'Failed to load following' : null));

  activateFollowingTab(): void {
    this._followingTabActive.set(true);
  }

  // Following's pagination has no cursor param wired here (see Task 9 note): the BFF's
  // `following` call always requests page 1 at a fixed size. "Load more" for Following is
  // deliberately out of scope for this plan — see the design spec's v1 scope; a proper
  // implementation needs the same page_index cursor threading Followers has, which the
  // /following BFF endpoint doesn't currently accept as an input (it derives its own).

  // ── Visitors tab ────────────────────────────────────────────────────────────────

  private readonly _visitorsTabActive = signal(false);
  private readonly _visitorsCursor = signal(0);

  private readonly visitorsRef = rxResource<VisitorsPage, { index: number } | undefined>({
    params: () => (this._visitorsTabActive() ? { index: this._visitorsCursor() } : undefined),
    stream: ({ params }) =>
      params === undefined ? of(EMPTY_VISITORS_PAGE) : this.api.visitors(params.index),
    defaultValue: EMPTY_VISITORS_PAGE,
  });

  readonly visitors = computed(() => this.visitorsRef.value().list);
  readonly visitorsMore = computed(() => this.visitorsRef.value().more);
  readonly visitorsLoading = this.visitorsRef.isLoading;
  readonly visitorsError = computed(() => (this.visitorsRef.error() ? 'Failed to load visitors' : null));

  activateVisitorsTab(): void {
    this._visitorsTabActive.set(true);
  }

  loadMoreVisitors(): void {
    const next = this.visitorsRef.value().index;
    if (next != null) this._visitorsCursor.set(next);
  }

  // ── Blocked users tab ───────────────────────────────────────────────────────────

  private readonly _blockedTabActive = signal(false);

  private readonly blockedRef = rxResource<readonly BlockedUser[], true | undefined>({
    params: () => (this._blockedTabActive() ? true : undefined),
    stream: ({ params }) => (params === undefined ? of([]) : this.api.blocklist()),
    defaultValue: [],
  });

  readonly blocked = this.blockedRef.value;
  readonly blockedLoading = this.blockedRef.isLoading;
  readonly blockedError = computed(() => (this.blockedRef.error() ? 'Failed to load blocked users' : null));

  activateBlockedTab(): void {
    this._blockedTabActive.set(true);
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/profile/store/profile.store.ts
git commit -m "feat(profile): add ProfileStore with bundle + 4 lazy tab resources"
```

---

### Task 5: UserListItemComponent (shared row for Followers/Following/Visitors)

**Files:**
- Create: `src/app/features/profile/ui/user-list-item.ts`

**Interfaces:**
- Consumes: `AvatarComponent` (`@shared/ui/avatar/avatar.component`), `CountryFlagComponent` (`@shared/ui/host-flag/country-flag`), `relativeTime` (`@shared/utils`, Task 1)
- Produces: `<app-user-list-item>` with inputs `name: string`, `headUrl: string | null`, `nationality: string | null`, `vipType: number | null`, `variant: 'followers' | 'following' | 'visitors'`, `isMutual: boolean` (only read when `variant === 'following'`), `visitTs: number | null` + `visitCnt: number | null` (only read when `variant === 'visitors'`) — consumed by Task 9's tab panels

- [ ] **Step 1: Write the component**

```typescript
// src/app/features/profile/ui/user-list-item.ts
import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { CountryFlagComponent } from '@shared/ui/host-flag/country-flag';
import { relativeTime } from '@shared/utils';
import { LucideCrown, LucideEye } from '@lucide/angular';

export type UserListItemVariant = 'followers' | 'following' | 'visitors';

@Component({
  selector: 'app-user-list-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, CountryFlagComponent, LucideCrown, LucideEye],
  template: `
    <div class="row">
      <app-avatar [src]="headUrl()" [initials]="initials()" size="md" [alt]="name()" />
      <div class="row-main">
        <div class="row-name-line">
          <span class="row-name">{{ name() }}</span>
          @if (vipType(); as vip) {
            @if (vip > 0) {
              <svg aria-hidden="true" lucideCrown [size]="11" class="vip-icon" />
            }
          }
        </div>
        @if (nationality()) {
          <app-country-flag [code]="nationality()" [compact]="true" />
        }
      </div>
      <div class="row-trailing">
        @switch (variant()) {
          @case ('following') {
            @if (isMutual()) {
              <span class="badge badge-mutual">Mutual</span>
            }
          }
          @case ('visitors') {
            @if (visitTs(); as ts) {
              <span class="visit-meta">
                <svg aria-hidden="true" lucideEye [size]="11" />
                {{ relativeTimeLabel(ts) }}
                @if (visitCnt(); as cnt) {
                  @if (cnt > 1) {
                    <span class="visit-count">&times;{{ cnt }}</span>
                  }
                }
              </span>
            }
          }
        }
      </div>
    </div>
  `,
  styles: `
    .row {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-lg);
      transition: background-color 0.15s ease;
    }
    .row:hover {
      background-color: var(--color-neutral-100);
    }
    :host-context(.dark) .row:hover {
      background-color: var(--color-neutral-800);
    }

    .row-main {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .row-name-line {
      display: flex;
      align-items: center;
      gap: 4px;
      min-width: 0;
    }

    .row-name {
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--color-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    :host-context(.dark) .row-name {
      color: var(--color-neutral-100);
    }

    .vip-icon {
      flex-shrink: 0;
      color: var(--color-gold-500);
    }

    .row-trailing {
      flex-shrink: 0;
      display: flex;
      align-items: center;
    }

    .badge {
      font-size: var(--text-2xs);
      font-weight: var(--font-semibold);
      padding: 2px 8px;
      border-radius: var(--radius-full);
    }
    .badge-mutual {
      background: var(--color-primary-50);
      color: var(--color-primary-600);
    }
    :host-context(.dark) .badge-mutual {
      background: var(--color-primary-900);
      color: var(--color-primary-300);
    }

    .visit-meta {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: var(--text-2xs);
      color: var(--color-text-muted);
    }
    :host-context(.dark) .visit-meta {
      color: var(--color-neutral-400);
    }

    .visit-count {
      font-weight: var(--font-semibold);
    }
  `,
})
export class UserListItemComponent {
  readonly name = input.required<string>();
  readonly headUrl = input<string | null>(null);
  readonly nationality = input<string | null>(null);
  readonly vipType = input<number | null>(null);
  readonly variant = input.required<UserListItemVariant>();
  readonly isMutual = input(false);
  readonly visitTs = input<number | null>(null);
  readonly visitCnt = input<number | null>(null);

  readonly initials = computed(() => this.name().slice(0, 2));

  protected relativeTimeLabel(ts: number): string {
    return relativeTime(ts);
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors. If `LucideEye` isn't exported from `@lucide/angular` in this version, check `npx grep -r "LucideEye\|lucide-eye" node_modules/@lucide/angular/icons/*.d.ts 2>/dev/null | head -1` — if it doesn't exist, swap to `LucideUsers` (already imported elsewhere in the app) instead and adjust the template's icon element to match.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/profile/ui/user-list-item.ts
git commit -m "feat(profile): add shared UserListItemComponent for social/visitor rows"
```

---

### Task 6: ProfileHeaderComponent (identity card)

**Files:**
- Create: `src/app/features/profile/ui/profile-header.ts`

**Interfaces:**
- Consumes: `UserInfo` type from `@core/services/user-info.service.ts`; `AvatarComponent`, `CountryFlagComponent`, `LanguageTagComponent` (all existing, same imports as `UserInfoModalComponent`)
- Produces: `<app-profile-header [info]="..." [registeredTs]="...">` — consumed by Task 9

- [ ] **Step 1: Write the component**

```typescript
// src/app/features/profile/ui/profile-header.ts
import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { UserInfo } from '@core/services/user-info.service';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { CountryFlagComponent } from '@shared/ui/host-flag/country-flag';
import { LanguageTagComponent } from '@shared/ui/host-flag/language-tag';
import { LucideCrown } from '@lucide/angular';

@Component({
  selector: 'app-profile-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, CountryFlagComponent, LanguageTagComponent, LucideCrown],
  template: `
    <div class="identity-card" [class.identity-card--vip]="vipType() === 100">
      <app-avatar
        [src]="avatarUrl()"
        [initials]="initials()"
        size="xl"
        [alt]="displayName()"
        [ringColor]="vipType() === 100 ? 'var(--color-gold-300)' : 'var(--color-primary-300)'"
      />

      <div class="identity-main">
        <div class="name-row">
          <span class="user-name">{{ displayName() }}</span>
          @if (vipType() === 100) {
            <span class="chip chip-gold"><svg aria-hidden="true" lucideCrown [size]="9"></svg>VIP</span>
          } @else if (vipType(); as vip) {
            @if (vip > 0) {
              <span class="chip chip-primary"><svg aria-hidden="true" lucideCrown [size]="9"></svg>VIP</span>
            }
          }
        </div>
        @if (username()) {
          <span class="user-handle">&#64;{{ username() }}</span>
        }

        @if (signature()) {
          <p class="bio">{{ signature() }}</p>
        }

        <div class="meta-row">
          @if (nationality()) {
            <app-country-flag [code]="nationality()" />
          }
          @if (location(); as loc) {
            <span class="meta-text">{{ loc }}</span>
          }
          @if (regDays() != null) {
            <span class="meta-text muted">Member for {{ regDays() }}d</span>
          }
        </div>

        @if (nativeLang() || learnLangs().length) {
          <div class="lang-row">
            @if (nativeLang(); as lang) {
              <app-language-tag [langId]="lang" />
            }
            @if (learnLangs().length) {
              <span class="meta-text muted">also learning</span>
              @for (lang of learnLangs(); track lang.langId) {
                <app-language-tag [langId]="lang.langId" />
              }
            }
          </div>
        }

        @if (tagChips().length) {
          <div class="tags-row">
            @for (chip of tagChips(); track $index) {
              <span class="tag">{{ chip }}</span>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .identity-card {
      display: flex;
      align-items: flex-start;
      gap: var(--space-4);
      padding: var(--space-5);
      background: var(--color-card);
      border-radius: var(--radius-xl);
      border: 1px solid var(--color-border);
    }
    .identity-card--vip {
      border-color: var(--color-gold-400);
    }
    :host-context(.dark) .identity-card {
      background: var(--color-neutral-800);
      border-color: var(--color-neutral-700);
    }

    .identity-main {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      min-width: 0;
      flex: 1;
    }

    .name-row {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .user-name {
      font-size: var(--text-xl);
      font-weight: var(--font-bold);
      color: var(--color-text);
    }
    :host-context(.dark) .user-name {
      color: var(--color-neutral-100);
    }

    .user-handle {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }
    :host-context(.dark) .user-handle {
      color: var(--color-neutral-400);
    }

    .bio {
      margin: 0;
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      line-height: var(--leading-normal);
    }
    :host-context(.dark) .bio {
      color: var(--color-neutral-300);
    }

    .meta-row,
    .lang-row,
    .tags-row {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--space-2);
    }

    .meta-text {
      font-size: var(--text-xs);
      color: var(--color-text);
    }
    .meta-text.muted {
      color: var(--color-text-muted);
    }
    :host-context(.dark) .meta-text {
      color: var(--color-neutral-200);
    }
    :host-context(.dark) .meta-text.muted {
      color: var(--color-neutral-400);
    }

    .tag {
      font-size: var(--text-xs);
      padding: 2px 10px;
      border-radius: var(--radius-full);
      background: var(--color-neutral-100);
      color: var(--color-text-secondary);
      border: 1px solid var(--color-neutral-200);
    }
    :host-context(.dark) .tag {
      background: var(--color-neutral-700);
      color: var(--color-neutral-300);
      border-color: var(--color-neutral-600);
    }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: var(--text-2xs);
      font-weight: var(--font-semibold);
      padding: 2px 6px;
      border-radius: var(--radius-full);
    }
    .chip-gold {
      background: var(--color-gold-50);
      color: var(--color-gold-600);
    }
    .chip-primary {
      background: var(--color-primary-50);
      color: var(--color-primary-600);
    }
    :host-context(.dark) .chip-gold {
      background: color-mix(in srgb, var(--color-gold-500) 20%, transparent);
      color: var(--color-gold-300);
    }
    :host-context(.dark) .chip-primary {
      background: var(--color-primary-900);
      color: var(--color-primary-300);
    }

    @container profile-page (min-width: 640px) {
      .identity-card {
        align-items: center;
      }
    }
  `,
})
export class ProfileHeaderComponent {
  readonly info = input<UserInfo | null>(null);

  private readonly details = computed(() => this.info()?.details ?? null);
  private readonly base = computed(() => this.details()?.base ?? null);

  readonly displayName = computed(() => this.info()?.nickname ?? 'User');
  readonly avatarUrl = computed(() => this.base()?.headUrl ?? '');
  readonly initials = computed(() => this.displayName().slice(0, 2));
  readonly username = computed(() => this.info()?.username ?? null);
  readonly signature = computed(() => this.base()?.signature ?? null);
  readonly nationality = computed(() => this.info()?.nationality ?? null);
  readonly regDays = computed(() => this.info()?.regDays ?? null);
  readonly vipType = computed(() => this.base()?.vipType ?? 0);
  readonly nativeLang = computed(() => this.base()?.nativeLang ?? null);
  readonly learnLangs = computed(() => this.base()?.learnLangs ?? []);
  readonly tagChips = computed<readonly string[]>(() => this.info()?.tags ?? []);

  readonly location = computed(() => {
    const loc = this.details()?.location;
    const city = this.info()?.city ?? loc?.city ?? null;
    const country = this.info()?.fullCountry ?? loc?.fullCountry ?? null;
    const parts = [city, country].filter((p): p is string => !!p);
    return parts.length ? parts.join(', ') : null;
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/profile/ui/profile-header.ts
git commit -m "feat(profile): add ProfileHeaderComponent identity card"
```

---

### Task 7: ProfileStatsBarComponent

**Files:**
- Create: `src/app/features/profile/ui/profile-stats-bar.ts`

**Interfaces:**
- Produces: `<app-profile-stats-bar [followers]="n" [following]="n" [moments]="n" [likes]="n" (followersClick)="..." (followingClick)="...">` — consumed by Task 9

- [ ] **Step 1: Write the component**

```typescript
// src/app/features/profile/ui/profile-stats-bar.ts
import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';

@Component({
  selector: 'app-profile-stats-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stats-bar">
      <button type="button" class="stat-cell" (click)="followersClick.emit()">
        <span class="stat-val">{{ followers() }}</span>
        <span class="stat-lbl">Followers</span>
      </button>
      <button type="button" class="stat-cell" (click)="followingClick.emit()">
        <span class="stat-val">{{ following() }}</span>
        <span class="stat-lbl">Following</span>
      </button>
      <div class="stat-cell stat-cell--static">
        <span class="stat-val">{{ moments() }}</span>
        <span class="stat-lbl">Moments</span>
      </div>
      <div class="stat-cell stat-cell--static">
        <span class="stat-val">{{ likes() }}</span>
        <span class="stat-lbl">Likes</span>
      </div>
    </div>
  `,
  styles: `
    .stats-bar {
      display: flex;
      align-items: stretch;
      background: var(--color-card);
      border-radius: var(--radius-xl);
      border: 1px solid var(--color-border);
      overflow: hidden;
    }
    :host-context(.dark) .stats-bar {
      background: var(--color-neutral-800);
      border-color: var(--color-neutral-700);
    }

    .stat-cell {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      padding: var(--space-3) var(--space-2);
      border: none;
      background: transparent;
      cursor: pointer;
      transition: background-color 0.15s ease;
    }
    .stat-cell:not(.stat-cell--static):hover {
      background-color: var(--color-neutral-100);
    }
    :host-context(.dark) .stat-cell:not(.stat-cell--static):hover {
      background-color: var(--color-neutral-700);
    }
    .stat-cell:not(:last-child) {
      border-right: 1px solid var(--color-border);
    }
    :host-context(.dark) .stat-cell:not(:last-child) {
      border-right-color: var(--color-neutral-700);
    }
    .stat-cell--static {
      cursor: default;
    }
    .stat-cell:focus-visible {
      outline: var(--focus-ring);
      outline-offset: -2px;
    }

    .stat-val {
      font-size: var(--text-lg);
      font-weight: var(--font-bold);
      color: var(--color-text);
    }
    :host-context(.dark) .stat-val {
      color: var(--color-neutral-100);
    }

    .stat-lbl {
      font-size: var(--text-2xs);
      color: var(--color-text-muted);
    }
    :host-context(.dark) .stat-lbl {
      color: var(--color-neutral-400);
    }
  `,
})
export class ProfileStatsBarComponent {
  readonly followers = input(0);
  readonly following = input(0);
  readonly moments = input(0);
  readonly likes = input(0);

  readonly followersClick = output<void>();
  readonly followingClick = output<void>();
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/profile/ui/profile-stats-bar.ts
git commit -m "feat(profile): add ProfileStatsBarComponent"
```

---

### Task 8: BlockedListComponent

**Files:**
- Create: `src/app/features/profile/ui/blocked-list.ts`

**Interfaces:**
- Consumes: `BlockedUser` type (Task 2), `AvatarComponent`
- Produces: `<app-blocked-list [users]="...">` — consumed by Task 9

- [ ] **Step 1: Write the component**

```typescript
// src/app/features/profile/ui/blocked-list.ts
import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { BlockedUser } from '../models/profile.model';
import { LucideShieldOff } from '@lucide/angular';

@Component({
  selector: 'app-blocked-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, LucideShieldOff],
  template: `
    @if (users().length === 0) {
      <div class="empty-state">
        <svg aria-hidden="true" lucideShieldOff [size]="28" class="empty-icon" />
        <p class="empty-text">No blocked users</p>
      </div>
    } @else {
      <ul class="list">
        @for (user of users(); track user.userId) {
          <li class="row">
            <app-avatar
              [src]="user.headUrl"
              [initials]="(user.nickName ?? 'U').slice(0, 2)"
              size="md"
              [alt]="user.nickName ?? 'Blocked user'"
            />
            <span class="row-name">{{ user.nickName ?? 'Unknown user' }}</span>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      padding: var(--space-8) var(--space-4);
      color: var(--color-text-muted);
    }
    :host-context(.dark) .empty-state {
      color: var(--color-neutral-400);
    }
    .empty-icon {
      opacity: 0.5;
    }
    .empty-text {
      margin: 0;
      font-size: var(--text-sm);
    }

    .list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .row {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-3);
    }

    .row-name {
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--color-text);
    }
    :host-context(.dark) .row-name {
      color: var(--color-neutral-100);
    }
  `,
})
export class BlockedListComponent {
  readonly users = input<readonly BlockedUser[]>([]);
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors. If `LucideShieldOff` doesn't exist in the installed `@lucide/angular` version, swap for `LucideBan` or `LucideUserX` (check `node_modules/@lucide/angular/icons/` for available names) and update the template's icon element to match.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/profile/ui/blocked-list.ts
git commit -m "feat(profile): add BlockedListComponent"
```

---

### Task 9: ProfilePageComponent — wire everything together

**Files:**
- Modify (replace stub): `src/app/features/profile/pages/profile-page.component.ts`

**Interfaces:**
- Consumes: `ProfileStore` (Task 4, provided here), `ProfileHeaderComponent` (Task 6), `ProfileStatsBarComponent` (Task 7), `UserListItemComponent` (Task 5), `BlockedListComponent` (Task 8), `ButtonComponent` (`@shared/ui/button/button.component`, existing)
- Produces: the routed page — no further consumers within this plan

- [ ] **Step 1: Write the page component**

```typescript
// src/app/features/profile/pages/profile-page.component.ts
import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { Tabs, TabList, Tab, TabPanel, TabContent } from '@angular/aria/tabs';
import { ProfileStore } from '../store/profile.store';
import { ProfileHeaderComponent } from '../ui/profile-header';
import { ProfileStatsBarComponent } from '../ui/profile-stats-bar';
import { UserListItemComponent } from '../ui/user-list-item';
import { BlockedListComponent } from '../ui/blocked-list';
import { ButtonComponent } from '@shared/ui/button/button.component';

type ProfileTab = 'followers' | 'following' | 'visitors' | 'blocked';

@Component({
  selector: 'app-profile-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ProfileStore],
  imports: [
    Tabs,
    TabList,
    Tab,
    TabPanel,
    TabContent,
    ProfileHeaderComponent,
    ProfileStatsBarComponent,
    UserListItemComponent,
    BlockedListComponent,
    ButtonComponent,
  ],
  template: `
    <div class="profile-page">
      @if (store.bundleLoading() && !store.userInfo()) {
        <div class="header-skeleton">
          <div class="skeleton-avatar"></div>
          <div class="skeleton-lines">
            <div class="skeleton-line skeleton-line--wide"></div>
            <div class="skeleton-line"></div>
          </div>
        </div>
      } @else if (store.bundleError(); as err) {
        <div class="error-state">
          <p>{{ err }}</p>
          <app-button variant="soft-neutral" size="sm" (click)="store.reloadBundle()">Retry</app-button>
        </div>
      } @else {
        <app-profile-header [info]="store.userInfo()" />

        <app-profile-stats-bar
          [followers]="store.userInfo()?.details?.relation?.followers ?? 0"
          [following]="store.userInfo()?.details?.relation?.following ?? 0"
          [moments]="store.stats()?.totalMntCount ?? 0"
          [likes]="store.userInfo()?.details?.relation?.likes ?? 0"
          (followersClick)="selectTab('followers')"
          (followingClick)="selectTab('following')"
        />
      }

      <div class="tabs-section" ngTabs>
        <ul ngTabList class="tabs" [(selectedTab)]="activeTab" (selectedTabChange)="onTabChange($event)">
          <li ngTab value="followers" class="tab-btn">Followers</li>
          <li ngTab value="following" class="tab-btn">Following</li>
          <li ngTab value="visitors" class="tab-btn">Visitors</li>
          <li ngTab value="blocked" class="tab-btn">Blocked</li>
        </ul>

        <div ngTabPanel value="followers" class="tab-panel">
          <ng-template ngTabContent>
            @if (store.followersLoading() && store.followers().length === 0) {
              <div class="list-skeleton">
                @for (i of [1, 2, 3]; track i) {
                  <div class="skeleton-row"></div>
                }
              </div>
            } @else if (store.followersError(); as err) {
              <div class="error-state"><p>{{ err }}</p></div>
            } @else if (store.followers().length === 0) {
              <div class="empty-state"><p>No followers yet</p></div>
            } @else {
              @for (user of store.followers(); track user.userId) {
                <app-user-list-item
                  variant="followers"
                  [name]="user.nickName ?? 'User'"
                  [headUrl]="user.headUrl"
                  [nationality]="user.nationality"
                  [vipType]="user.vipType"
                />
              }
              @if (store.followersMore()) {
                <app-button variant="soft-neutral" size="sm" (click)="store.loadMoreFollowers()">
                  Load more
                </app-button>
              }
            }
          </ng-template>
        </div>

        <div ngTabPanel value="following" class="tab-panel">
          <ng-template ngTabContent>
            @if (store.followingLoading() && store.following().length === 0) {
              <div class="list-skeleton">
                @for (i of [1, 2, 3]; track i) {
                  <div class="skeleton-row"></div>
                }
              </div>
            } @else if (store.followingError(); as err) {
              <div class="error-state"><p>{{ err }}</p></div>
            } @else if (store.following().length === 0) {
              <div class="empty-state"><p>You're not following anyone yet</p></div>
            } @else {
              @for (user of store.following(); track user.userId) {
                <app-user-list-item
                  variant="following"
                  [name]="user.nickName ?? 'User'"
                  [headUrl]="user.headUrl"
                  [nationality]="user.nationality"
                  [vipType]="user.vipType"
                  [isMutual]="user.isMutual"
                />
              }
            }
          </ng-template>
        </div>

        <div ngTabPanel value="visitors" class="tab-panel">
          <ng-template ngTabContent>
            @if (store.visitorsLoading() && store.visitors().length === 0) {
              <div class="list-skeleton">
                @for (i of [1, 2, 3]; track i) {
                  <div class="skeleton-row"></div>
                }
              </div>
            } @else if (store.visitorsError(); as err) {
              <div class="error-state"><p>{{ err }}</p></div>
            } @else if (store.visitors().length === 0) {
              <div class="empty-state"><p>No visitors yet</p></div>
            } @else {
              @for (user of store.visitors(); track user.userid) {
                <app-user-list-item
                  variant="visitors"
                  [name]="user.nickname ?? 'User'"
                  [headUrl]="user.headUrl"
                  [nationality]="user.nationality"
                  [visitTs]="user.visitTs"
                  [visitCnt]="user.visitCnt"
                />
              }
              @if (store.visitorsMore()) {
                <app-button variant="soft-neutral" size="sm" (click)="store.loadMoreVisitors()">
                  Load more
                </app-button>
              }
            }
          </ng-template>
        </div>

        <div ngTabPanel value="blocked" class="tab-panel">
          <ng-template ngTabContent>
            @if (store.blockedLoading()) {
              <div class="list-skeleton">
                @for (i of [1, 2]; track i) {
                  <div class="skeleton-row"></div>
                }
              </div>
            } @else if (store.blockedError(); as err) {
              <div class="error-state"><p>{{ err }}</p></div>
            } @else {
              <app-blocked-list [users]="store.blocked()" />
            }
          </ng-template>
        </div>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      container-type: inline-size;
      container-name: profile-page;
    }

    .profile-page {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      padding: var(--space-4);
      max-width: 720px;
      margin: 0 auto;
    }

    .tabs-section {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .tabs {
      display: flex;
      gap: var(--space-1);
      list-style: none;
      margin: 0;
      padding: var(--space-1);
      background: var(--color-neutral-100);
      border-radius: var(--radius-full);
      width: fit-content;
    }
    :host-context(.dark) .tabs {
      background: var(--color-neutral-800);
    }

    .tab-btn {
      padding: var(--space-2) var(--space-4);
      border-radius: var(--radius-full);
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--color-text-muted);
      cursor: pointer;
      transition: background-color 0.15s ease, color 0.15s ease;
    }
    .tab-btn[aria-selected='true'] {
      background: var(--color-card);
      color: var(--color-primary-600);
    }
    :host-context(.dark) .tab-btn {
      color: var(--color-neutral-400);
    }
    :host-context(.dark) .tab-btn[aria-selected='true'] {
      background: var(--color-neutral-700);
      color: var(--color-primary-300);
    }

    .tab-panel {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .empty-state,
    .error-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-8) var(--space-4);
      color: var(--color-text-muted);
      font-size: var(--text-sm);
    }
    :host-context(.dark) .empty-state,
    :host-context(.dark) .error-state {
      color: var(--color-neutral-400);
    }

    .header-skeleton {
      display: flex;
      gap: var(--space-4);
      padding: var(--space-5);
    }
    .skeleton-avatar {
      width: 80px;
      height: 80px;
      border-radius: var(--radius-full);
      background: linear-gradient(90deg, var(--color-neutral-200) 25%, var(--color-neutral-100) 50%, var(--color-neutral-200) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
      flex-shrink: 0;
    }
    .skeleton-lines {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      justify-content: center;
    }
    .skeleton-line {
      height: 14px;
      width: 50%;
      border-radius: var(--radius-sm);
      background: linear-gradient(90deg, var(--color-neutral-200) 25%, var(--color-neutral-100) 50%, var(--color-neutral-200) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
    }
    .skeleton-line--wide {
      width: 70%;
      height: 18px;
    }
    .skeleton-row {
      height: 48px;
      border-radius: var(--radius-lg);
      background: linear-gradient(90deg, var(--color-neutral-200) 25%, var(--color-neutral-100) 50%, var(--color-neutral-200) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
    }
    .list-skeleton {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }
    :host-context(.dark) .skeleton-avatar,
    :host-context(.dark) .skeleton-line,
    :host-context(.dark) .skeleton-row {
      background: linear-gradient(90deg, var(--color-neutral-700) 25%, var(--color-neutral-600) 50%, var(--color-neutral-700) 75%);
      background-size: 200% 100%;
    }
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .skeleton-avatar, .skeleton-line, .skeleton-row { animation: none; }
    }
  `,
})
export class ProfilePageComponent {
  protected readonly store = inject(ProfileStore);

  protected readonly activeTab = signal<ProfileTab>('followers');

  protected selectTab(tab: ProfileTab): void {
    this.activeTab.set(tab);
    this.onTabChange(tab);
  }

  protected onTabChange(tab: ProfileTab): void {
    switch (tab) {
      case 'followers':
        this.store.activateFollowersTab();
        break;
      case 'following':
        this.store.activateFollowingTab();
        break;
      case 'visitors':
        this.store.activateVisitorsTab();
        break;
      case 'blocked':
        this.store.activateBlockedTab();
        break;
    }
  }
}
```

Note: the default `activeTab` is `'followers'`, but `onTabChange` only runs on a *change* event — the initially-selected tab needs its data activated on init too. Add this to make the first tab load automatically:

```typescript
export class ProfilePageComponent {
  protected readonly store = inject(ProfileStore);

  protected readonly activeTab = signal<ProfileTab>('followers');

  constructor() {
    this.onTabChange(this.activeTab());
  }

  // ...selectTab and onTabChange unchanged
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/profile/pages/profile-page.component.ts
git commit -m "feat(profile): wire ProfilePageComponent — header, stats, tabs"
```

---

### Task 10: Manual end-to-end verification against the live BFF

This feature has no automated component/integration tests (consistent with this codebase's existing test coverage — see the design spec's note that only 8 `.spec.ts` files exist repo-wide, mostly for pure logic). Verification is manual, against the real backend, matching how every other feature this session was verified.

**Files:** none (verification only)

- [ ] **Step 1: Confirm the BFF is running**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/api/profile/me`
Expected: `200`. If not running, start it: `cd /home/mohammed/Desktop/JilaliTalk/jilalibff && nohup ./gradlew run > /tmp/jilalibff.log 2>&1 & disown` and wait for `"Startup completed"` in the log before proceeding.

- [ ] **Step 2: Start the Angular dev server**

Run: `cd /home/mohammed/Desktop/JilaliTalk/JilaliTalk-angular-frontend && npm start` (or confirm it's already running on port 4200 — check with `ss -tlnp | grep 4200`).

- [ ] **Step 3: Navigate to /profile in a browser and verify**

Open `http://localhost:4200/profile`. Check:
- Identity card renders with real avatar, nickname, and (if present) bio/tags/languages — not placeholder/blank.
- Stats bar shows real follower/following/moment/like counts matching what `curl http://localhost:8080/api/profile/169335562/bundle` returns for `details.relation.followers` etc.
- Clicking "Followers" tab loads real rows (compare against `curl http://localhost:8080/api/profile/followers?pageSize=5`).
- Clicking "Following" tab loads real rows.
- Clicking "Visitors" tab shows the empty state (confirmed via curl in the design phase that this returns `{"msg":"no data currently"}` for the current test account — an empty state here is the CORRECT result, not a bug).
- Clicking "Blocked" tab shows the empty state.
- Switching between tabs and back does not re-trigger a network request for a tab already loaded — open browser DevTools Network tab, switch Followers → Following → Followers, confirm only one `GET /api/profile/followers` call total.
- Toggle dark mode (theme toggle in the header) and confirm every element in the new page still has readable contrast — no hardcoded-white or invisible-text regressions.
- Resize the viewport below 640px and confirm the identity card stacks to a single column (no horizontal overflow).

- [ ] **Step 4: Fix anything broken, then re-verify**

If any check in Step 3 fails, fix the specific component/store code involved and re-run only that check — don't re-verify the whole list unless the fix could plausibly affect other areas.

- [ ] **Step 5: Final full check**

Run: `npx vitest run && npx tsc --noEmit -p tsconfig.app.json`
Expected: all tests pass, zero type errors.

- [ ] **Step 6: Commit if Step 4 produced any fixes**

```bash
git add -A
git commit -m "fix(profile): address issues found in manual verification"
```

(Skip this step if Step 3 passed clean with no fixes needed.)
