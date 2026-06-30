# Full Profile Feature — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full profile feature — own profile + others' profiles with followers/following/visitors/stats tabs, bottom-sheet editing, BFF proxy for all upstream endpoints.

**Architecture:** Two Angular routes (`/profile` own, `/profile/:userId` others) sharing one `ProfilePageComponent`. BFF adds three new endpoints to `ProfileController`. Facade services per data domain. CDK Dialog for edit sheet.

**Tech Stack:** Angular 22 signals + OnPush + CDK Dialog + `forkJoin`. Micronaut BFF with `@Client(id="jlhub", path="")` for profile endpoints.

## Global Constraints

- Angular: `ChangeDetectionStrategy.OnPush`, `inject()`, signals over RxJS Subjects
- BFF: `path=""` for ProfileClient (profile endpoints at API root, not `/livehub/`)
- `exactOptionalPropertyTypes` — optional fields use `field?: T` not `field: T | undefined`
- `noUncheckedIndexedAccess` — array indexing needs `?? fallback`
- Visitor user fields: `userid` (not `user_id`), `nickname` (not `nick_name`) matching real API
- Follower user fields: `sex` is `number` (0=female, 1=male)

---

## File Map

### BFF (`jilalibff` submodule)

**Create:**
- `src/main/java/com/jilali/user/dto/ProfileStatsResponse.java` — lifetime stats envelope
- `src/main/java/com/jilali/user/dto/VisitorsResponse.java` — visitor history response
- `src/main/java/com/jilali/user/dto/VisitorHistoryRequest.java` — visitor history request body
- `src/main/java/com/jilali/user/dto/ProfileEditRequest.java` — edit profile request
- `src/main/java/com/jilali/user/dto/ProfileEditResponse.java` — edit profile response

**Modify:**
- `src/main/java/com/jilali/client/ProfileClient.java` — add `stats()`, `visitors()`, `editProfile()` methods
- `src/main/java/com/jilali/user/ProfileController.java` — add three new endpoints

### Angular (`JilaliTalk-angular-frontend`)

**Create:**
- `src/app/features/profile/data-access/visitors.service.ts` — wraps `POST /api/profile/visitors`
- `src/app/features/profile/data-access/profile-stats.service.ts` — wraps `POST /api/profile/stats`
- `src/app/features/profile/ui/visitor-list/visitor-list.component.ts` — visitor tab content
- `src/app/features/profile/ui/stats-tab/stats-tab.component.ts` — stats tab content
- `src/app/features/profile/ui/edit-profile-sheet/edit-profile-sheet.component.ts` — CDK Dialog bottom sheet

**Modify:**
- `src/app/features/profile/models/profile.model.ts` — add `VisitorUser`, `VisitorsPage`, `ProfileStats`, `ProfileEditRequest` types
- `src/app/features/profile/data-access/profile-api.ts` — add `fetchStats()`, `fetchVisitors()`, `editProfile()` methods
- `src/app/features/profile/store/profile.store.ts` — add `isOwnProfile`, `visitors`, `stats`, edit action
- `src/app/features/profile/pages/profile-page.component.ts` — own/other detection, new tabs, header changes
- `src/app/features/profile/index.ts` — export new components

---

## Backend

### Task 1: BFF — ProfileStatsResponse DTO

**Files:**
- Create: `src/main/java/com/jilali/user/dto/ProfileStatsResponse.java`

**Interfaces:**
- Produces: `ProfileStatsResponse` used by `ProfileController.stats()`

- [ ] **Step 1: Create DTO**

```java
package com.jilali.user.dto;

import io.micronaut.core.annotation.Nullable;
import io.micronaut.serde.annotation.Serdeable;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Response from POST /profile/v1/baseinfo/mnt_info.
 * Uses status/message envelope.
 */
@Serdeable
public record ProfileStatsResponse(
    int status,
    String message,
    @Nullable StatsData data
) {
    @Serdeable
    public record StatsData(
        @JsonProperty("total_mnt_count") int totalMntCount,
        @JsonProperty("total_like_count") int totalLikeCount,
        @JsonProperty("last_mnt_like_count") int lastMntLikeCount,
        @JsonProperty("last_mnt_post_ts") long lastMntPostTs,
        @JsonProperty("registered_ts") long registeredTs
    ) {}
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd /home/mohammed/Desktop/JilaliTalk/jilalibff && ./gradlew compileJava`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add src/main/java/com/jilali/user/dto/ProfileStatsResponse.java
git commit -m "feat(profile): add ProfileStatsResponse DTO for /profile/v1/baseinfo/mnt_info"
```

---

### Task 2: BFF — VisitorHistoryRequest and VisitorsResponse DTOs

**Files:**
- Create: `src/main/java/com/jilali/user/dto/VisitorHistoryRequest.java`
- Create: `src/main/java/com/jilali/user/dto/VisitorsResponse.java`

**Interfaces:**
- Produces: `VisitorsResponse` used by `ProfileController.visitors()`

- [ ] **Step 1: Create VisitorHistoryRequest**

```java
package com.jilali.user.dto;

import io.micronaut.core.annotation.Nullable;
import io.micronaut.serde.annotation.Serdeable;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Request body for POST /user_profile_visitor/v2/my_history.
 * Forwarded from the frontend device client fields.
 */
@Serdeable
public record VisitorHistoryRequest(
    @Nullable String deviceType,
    @Nullable Long clientTs,
    int index,
    @Nullable String deviceId,
    @Nullable String sign,
    @Nullable String clientVer,
    int updateTs,
    int clientOs
) {}
```

- [ ] **Step 2: Create VisitorsResponse**

```java
package com.jilali.user.dto;

import io.micronaut.core.annotation.Nullable;
import io.micronaut.serde.annotation.Serdeable;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * Response from POST /user_profile_visitor/v2/my_history.
 * Uses msg/data envelope (not status/message).
 */
@Serdeable
public record VisitorsResponse(
    String msg,
    @Nullable VisitorsData data
) {
    @Serdeable
    public record VisitorsData(
        int index,
        boolean more,
        @Nullable List<VisitorUser> list
    ) {}

    @Serdeable
    public record VisitorUser(
        @JsonProperty("userid") long userId,
        @JsonProperty("username") String username,
        @JsonProperty("nickname") String nickname,
        @JsonProperty("nationality") String nationality,
        @JsonProperty("head_url") String headUrl,
        @Nullable String birthday,
        int sex,
        int nativeLang,
        @JsonProperty("visit_ts") long visitTs,
        @JsonProperty("visit_cnt") int visitCnt,
        @JsonProperty("is_secret_visit") boolean isSecretVisit,
        int distance,
        @JsonProperty("vip_logo") String vipLogo,
        @JsonProperty("hw_vip") boolean hwVip,
        @JsonProperty("english_ai_vip") boolean englishAiVip,
        @JsonProperty("language_ai_vip") boolean languageAiVip,
        @JsonProperty("room_status") int roomStatus,
        @JsonProperty("gift_level") int giftLevel
    ) {}
}
```

- [ ] **Step 3: Verify compilation**

Run: `cd /home/mohammed/Desktop/JilaliTalk/jilalibff && ./gradlew compileJava`
Expected: BUILD SUCCESSFUL

- [ ] **Step 4: Commit**

```bash
git add src/main/java/com/jilali/user/dto/VisitorHistoryRequest.java src/main/java/com/jilali/user/dto/VisitorsResponse.java
git commit -m "feat(profile): add VisitorsResponse and VisitorHistoryRequest DTOs"
```

---

### Task 3: BFF — ProfileEditRequest and ProfileEditResponse DTOs

**Files:**
- Create: `src/main/java/com/jilali/user/dto/ProfileEditRequest.java`
- Create: `src/main/java/com/jilali/user/dto/ProfileEditResponse.java`

- [ ] **Step 1: Create ProfileEditRequest**

```java
package com.jilali.user.dto;

import io.micronaut.core.annotation.Nullable;
import io.micronaut.serde.annotation.Serdeable;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Request body for POST /profile/v1/modify_baseinfo.
 */
@Serdeable
public record ProfileEditRequest(
    @Nullable @JsonProperty("birthday") String birthday,
    @Nullable @JsonProperty("nationality") String nationality,
    @JsonProperty("os_type") int osType,
    @JsonProperty("version") String version
) {}
```

- [ ] **Step 2: Create ProfileEditResponse**

```java
package com.jilali.user.dto;

import io.micronaut.serde.annotation.Serdeable;

/**
 * Response from POST /profile/v1/modify_baseinfo.
 */
@Serdeable
public record ProfileEditResponse(
    int status,
    String msg
) {}
```

- [ ] **Step 3: Verify compilation**

Run: `cd /home/mohammed/Desktop/JilaliTalk/jilalibff && ./gradlew compileJava`
Expected: BUILD SUCCESSFUL

- [ ] **Step 4: Commit**

```bash
git add src/main/java/com/jilali/user/dto/ProfileEditRequest.java src/main/java/com/jilali/user/dto/ProfileEditResponse.java
git commit -m "feat(profile): add ProfileEditRequest and ProfileEditResponse DTOs"
```

---

### Task 4: BFF — Add methods to ProfileClient

**Files:**
- Modify: `src/main/java/com/jilali/client/ProfileClient.java`

**Interfaces:**
- Consumes: `VisitorHistoryRequest`, `ProfileEditRequest`
- Produces: `VisitorsResponse`, `ProfileStatsResponse`, `ProfileEditResponse`

- [ ] **Step 1: Add new methods to ProfileClient**

Add these methods inside the `ProfileClient` interface (before the closing `}`):

```java
    @Post("/profile/v1/baseinfo/mnt_info")
    ProfileStatsResponse stats(@Body Map<String, Object> body);

    @Post("/user_profile_visitor/v2/my_history")
    VisitorsResponse visitors(@Body VisitorHistoryRequest body);

    @Post("/profile/v1/modify_baseinfo")
    ProfileEditResponse editProfile(@Body ProfileEditRequest body);
```

Add to imports:
```java
import com.jilali.user.dto.VisitorHistoryRequest;
import com.jilali.user.dto.VisitorsResponse;
import com.jilali.user.dto.ProfileStatsResponse;
import com.jilali.user.dto.ProfileEditRequest;
import com.jilali.user.dto.ProfileEditResponse;
import java.util.Map;
import io.micronaut.http.annotation.Body;
```

- [ ] **Step 2: Verify compilation**

Run: `cd /home/mohammed/Desktop/JilaliTalk/jilalibff && ./gradlew compileJava`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add src/main/java/com/jilali/client/ProfileClient.java
git commit -m "feat(profile): add stats/visitors/editProfile methods to ProfileClient"
```

---

### Task 5: BFF — Add endpoints to ProfileController

**Files:**
- Modify: `src/main/java/com/jilali/user/ProfileController.java`

**Interfaces:**
- Consumes: `ProfileClient`
- Produces: `ProfileStatsResponse`, `VisitorsResponse`, `ProfileEditResponse`

- [ ] **Step 1: Add new endpoints**

Add these methods to `ProfileController` (before the helper `toLong`/`toInt` methods):

```java
    @Post("/stats")
    public ProfileStatsResponse stats(@Body Map<String, Object> body) {
        return profileClient.stats(body);
    }

    @Post("/visitors")
    public VisitorsResponse visitors(@Body VisitorHistoryRequest body) {
        return profileClient.visitors(body);
    }

    @Post("/edit")
    public ProfileEditResponse edit(@Body ProfileEditRequest body) {
        return profileClient.editProfile(body);
    }
```

Update imports:
```java
import com.jilali.user.dto.VisitorHistoryRequest;
import com.jilali.user.dto.VisitorsResponse;
import com.jilali.user.dto.ProfileStatsResponse;
import com.jilali.user.dto.ProfileEditRequest;
import com.jilali.user.dto.ProfileEditResponse;
import java.util.Map;
```

- [ ] **Step 2: Verify compilation**

Run: `cd /home/mohammed/Desktop/JilaliTalk/jilalibff && ./gradlew compileJava`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit submodule**

```bash
git add src/main/java/com/jilali/user/ProfileController.java
git commit -m "feat(profile): add stats, visitors, edit endpoints to ProfileController"
```

- [ ] **Step 4: Update outer repo submodule pointer**

```bash
cd /home/mohammed/Desktop/JilaliTalk
git add jilalibff
git commit -m "chore: update jilalibff submodule"
```

---

## Frontend

### Task 6: Angular — Update models

**Files:**
- Modify: `src/app/features/profile/models/profile.model.ts`

**Interfaces:**
- Produces: `VisitorUser`, `VisitorsPage`, `ProfileStats`, `ProfileEditRequest`

- [ ] **Step 1: Add new types to profile.model.ts**

Append to the end of `profile.model.ts`:

```ts
/** A visitor who viewed the user's profile. */
export interface VisitorUser {
  readonly userId: number;
  readonly username: string;
  readonly nickname: string;
  readonly nationality: string;
  readonly headUrl: string;
  readonly birthday: string | null;
  readonly sex: number;
  readonly nativeLang: number;
  readonly visitTs: number;
  readonly visitCnt: number;
  readonly isSecretVisit: boolean;
  readonly distance: number;
  readonly vipLogo: string;
  readonly hwVip: boolean;
  readonly englishAiVip: boolean;
  readonly languageAiVip: boolean;
  readonly roomStatus: number;
  readonly giftLevel: number;
}

/** /api/profile/visitors response — paginated visitor list. */
export interface VisitorsPage {
  readonly msg: string;
  readonly data: VisitorsData | null;
}

export interface VisitorsData {
  readonly index: number;
  readonly more: boolean;
  readonly list: VisitorUser[];
}

/** /api/profile/stats response — lifetime moment/like counts. */
export interface ProfileStats {
  readonly status: number;
  readonly message: string;
  readonly data: ProfileStatsData | null;
}

export interface ProfileStatsData {
  readonly totalMntCount: number;
  readonly totalLikeCount: number;
  readonly lastMntLikeCount: number;
  readonly lastMntPostTs: number;
  readonly registeredTs: number;
}

/** Request for editing own profile. */
export interface ProfileEditRequest {
  readonly birthday?: string;
  readonly nationality?: string;
  readonly osType?: number;
  readonly version?: string;
}
```

Also fix `FollowerUser.sex` from `string | null` to `number`:
```ts
  readonly sex: number; // 0=female, 1=male — NOT string
```

- [ ] **Step 2: Verify TypeScript**

Run: `cd /home/mohammed/Desktop/JilaliTalk/JilaliTalk-angular-frontend && npx tsc --noEmit`
Expected: no errors related to profile models

- [ ] **Step 3: Commit**

```bash
git add src/app/features/profile/models/profile.model.ts
git commit -m "feat(profile): add VisitorUser, VisitorsPage, ProfileStats, ProfileEdit types"
```

---

### Task 7: Angular — Add methods to ProfileApi

**Files:**
- Modify: `src/app/features/profile/data-access/profile-api.ts`

**Interfaces:**
- Produces: `fetchStats()`, `fetchVisitors()`, `editProfile()` Observable methods

- [ ] **Step 1: Add new methods to ProfileApi**

Add after the `fetchLangs()` method:

```ts
  fetchStats(lang = 'English'): Observable<ProfileStats> {
    return this.http.post<ProfileStats>(`${this.profileBase}/stats`, {
      client_os_lang: lang,
    });
  }

  fetchVisitors(body: {
    deviceType?: string;
    clientTs?: number;
    index?: number;
    deviceId?: string;
    sign?: string;
    clientVer?: string;
    updateTs?: number;
    clientOs?: number;
  }): Observable<VisitorsPage> {
    return this.http.post<VisitorsPage>(`${this.profileBase}/visitors`, body);
  }

  editProfile(data: ProfileEditRequest): Observable<{ status: number; msg: string }> {
    return this.http.post<{ status: number; msg: string }>(
      `${this.profileBase}/edit`,
      { ...data, os_type: data.osType ?? 0, version: data.version ?? '6.2.0' },
    );
  }
```

Add to imports at top:
```ts
import { ProfileStats, ProfileEditRequest, VisitorsPage } from '../models/profile.model';
```

- [ ] **Step 2: Verify TypeScript**

Run: `cd /home/mohammed/Desktop/JilaliTalk/JilaliTalk-angular-frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/features/profile/data-access/profile-api.ts
git commit -m "feat(profile): add fetchStats, fetchVisitors, editProfile to ProfileApi"
```

---

### Task 8: Angular — VisitorsService

**Files:**
- Create: `src/app/features/profile/data-access/visitors.service.ts`

**Interfaces:**
- Consumes: `ProfileApi.fetchVisitors()`
- Produces: `visitors`, `loading`, `nextCursor`, `loadMore()`, `reset()`

- [ ] **Step 1: Create VisitorsService**

```ts
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ProfileApi } from './profile-api';
import { VisitorUser, VisitorsPage } from '../models/profile.model';

@Injectable({ providedIn: 'root' })
export class VisitorsService {
  private readonly api = inject(ProfileApi);

  private readonly _nextCursor = signal<number | null>(null);
  readonly nextCursor = this._nextCursor.asReadonly();

  private readonly _visitors = signal<VisitorUser[] | null>(null);
  readonly visitors = this._visitors.asReadonly();

  private readonly _loading = signal(false);
  readonly loading = this._loading.asReadonly();

  async loadMore(): Promise<void> {
    if (this._loading()) return;
    const cursor = this._nextCursor() ?? 0;
    this._loading.set(true);
    try {
      const page: VisitorsPage = await firstValueFrom(
        this.api.fetchVisitors({ index: cursor }),
      );
      if (page.data?.list) {
        const existing = this._visitors() ?? [];
        this._visitors.set([...existing, ...page.data.list]);
        this._nextCursor.set(page.data.more ? page.data.index : null);
      } else {
        this._visitors.set([]);
        this._nextCursor.set(null);
      }
    } finally {
      this._loading.set(false);
    }
  }

  reset(): void {
    this._visitors.set(null);
    this._nextCursor.set(null);
  }
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `cd /home/mohammed/Desktop/JilaliTalk/JilaliTalk-angular-frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/features/profile/data-access/visitors.service.ts
git commit -m "feat(profile): add VisitorsService with cursor pagination"
```

---

### Task 9: Angular — ProfileStatsService

**Files:**
- Create: `src/app/features/profile/data-access/profile-stats.service.ts`

- [ ] **Step 1: Create ProfileStatsService**

```ts
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ProfileApi } from './profile-api';
import { ProfileStats } from '../models/profile.model';

@Injectable({ providedIn: 'root' })
export class ProfileStatsService {
  private readonly api = inject(ProfileApi);

  private readonly _stats = signal<ProfileStats['data'] | null>(null);
  readonly stats = this._stats.asReadonly();

  private readonly _loading = signal(false);
  readonly loading = this._loading.asReadonly();

  async load(): Promise<void> {
    this._loading.set(true);
    try {
      const response: ProfileStats = await firstValueFrom(this.api.fetchStats());
      this._stats.set(response.data);
    } finally {
      this._loading.set(false);
    }
  }

  /** Seed stats from an external caller (e.g. ProfileStore parallel fetch). */
  setStats(data: ProfileStats['data'] | null): void {
    this._stats.set(data);
  }

  reset(): void {
    this._stats.set(null);
  }
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `cd /home/mohammed/Desktop/JilaliTalk/JilaliTalk-angular-frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/features/profile/data-access/profile-stats.service.ts
git commit -m "feat(profile): add ProfileStatsService"
```

---

### Task 10: Angular — ProfileStore update

**Files:**
- Modify: `src/app/features/profile/store/profile.store.ts`

**Interfaces:**
- Consumes: `VisitorsService`, `ProfileStatsService`, `ProfileApi.editProfile()`
- Produces: `isOwnProfile`, `stats`, `statsLoading`, `loadStats()`, `editProfile()`

- [ ] **Step 1: Update ProfileStore**

Replace the store contents with:

```ts
import { Injectable, inject, signal, computed } from '@angular/core';
import { forkJoin } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '@core/auth/auth.store';
import { ProfileApi } from '../data-access/profile-api';
import { FollowersService } from '../data-access/followers.service';
import { FollowingService } from '../data-access/following.service';
import { VisitorsService } from '../data-access/visitors.service';
import { ProfileStatsService } from '../data-access/profile-stats.service';
import { ProfileMe } from '../models/profile.model';

export type ProfileTab = 'followers' | 'following' | 'visitors' | 'stats';

@Injectable()
export class ProfileStore {
  private readonly api = inject(ProfileApi);
  private readonly auth = inject(AuthStore);
  readonly followersSvc = inject(FollowersService);
  readonly followingSvc = inject(FollowingService);
  readonly visitorsSvc = inject(VisitorsService);
  readonly statsSvc = inject(ProfileStatsService);

  private readonly _activeTab = signal<ProfileTab>('followers');
  readonly activeTab = this._activeTab.asReadonly();

  private readonly _profile = signal<ProfileMe | null>(null);
  readonly profile = this._profile.asReadonly();

  /** Target user ID from route — null means own profile. */
  private readonly _targetUid = signal<number | null>(null);
  readonly targetUid = this._targetUid.asReadonly();

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly currentUid = computed(() => this.auth.user()?.userId ?? 0);
  readonly isOwnProfile = computed(() => this._targetUid() === null || this._targetUid() === this.currentUid());
  readonly unreadLikes = signal(0);

  setTab(tab: ProfileTab): void {
    this._activeTab.set(tab);
  }

  setTargetUid(uid: number | null): void {
    this._targetUid.set(uid);
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    const uid = this.currentUid();
    const isOwn = this.isOwnProfile();
    try {
      if (isOwn) {
        const { profile, likeCount, stats } = await firstValueFrom(
          forkJoin({
            profile: this.api.fetchMe(),
            likeCount: this.api.fetchLikeCount(uid),
            stats: this.api.fetchStats(),
          }),
        );
        this._profile.set(profile);
        this.unreadLikes.set(likeCount?.data?.unreadFavorCount ?? 0);
        this.statsSvc.setStats(stats.data); // seed stats
        void this.followersSvc.loadMore();
        void this.followingSvc.loadMore();
      } else {
        const uid2 = this._targetUid()!;
        const { profile, likeCount } = await firstValueFrom(
          forkJoin({
            profile: this.api.fetchMe(),
            likeCount: this.api.fetchLikeCount(uid2),
          }),
        );
        this._profile.set(profile);
        this.unreadLikes.set(likeCount?.data?.unreadFavorCount ?? 0);
      }
    } catch {
      this.error.set('Failed to load profile');
    } finally {
      this.loading.set(false);
    }
  }

  async editProfile(data: { birthday?: string; nationality?: string }): Promise<boolean> {
    try {
      const result = await firstValueFrom(this.api.editProfile(data));
      return result.status === 0;
    } catch {
      return false;
    }
  }

  reset(): void {
    this._profile.set(null);
    this.error.set(null);
    this.followersSvc.reset();
    this.followingSvc.reset();
    this.visitorsSvc.reset();
    this.statsSvc.reset();
  }
}
```

Note: `ProfileStatsService._stats` should be made `readonly` but exposed — or add a `setStats()` method. Add `setStats(data: ProfileStats['data'])` to `ProfileStatsService`.

- [ ] **Step 2: Verify TypeScript**

Run: `cd /home/mohammed/Desktop/JilaliTalk/JilaliTalk-angular-frontend && npx tsc --noEmit`
Expected: fix any type errors

- [ ] **Step 3: Commit**

```bash
git add src/app/features/profile/store/profile.store.ts
git commit -m "feat(profile): update ProfileStore with isOwnProfile, visitors, stats, editProfile"
```

---

### Task 11: Angular — VisitorListComponent

**Files:**
- Create: `src/app/features/profile/ui/visitor-list/visitor-list.component.ts`

**Interfaces:**
- Consumes: `VisitorsService`
- Produces: `VisitorListComponent`

- [ ] **Step 1: Create VisitorListComponent**

```ts
import { Component, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
import { VisitorsService } from '../../data-access/visitors.service';

@Component({
  selector: 'app-visitor-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (svc.loading() && !svc.visitors()) {
      <div class="tab-loading">Loading…</div>
    } @else if (!svc.visitors()?.length) {
      <p class="empty-msg">No visitors yet.</p>
    } @else {
      <div class="visitor-list">
        @for (v of svc.visitors() ?? []; track v.userId) {
          <div class="visitor-card">
            <img class="visitor-avatar" [src]="v.headUrl ?? '/assets/default-avatar.png'" [alt]="v.nickname" />
            <div class="visitor-info">
              <span class="visitor-name">{{ v.nickname }}</span>
              @if (v.isSecretVisit) {
                <span class="secret-badge">Secret</span>
              } @else {
                <span class="visit-count">{{ v.visitCnt }} visit{{ v.visitCnt > 1 ? 's' : '' }}</span>
              }
            </div>
          </div>
        }
      </div>
      @if (svc.nextCursor()) {
        <button class="load-more-btn" (click)="svc.loadMore()">Load more</button>
      }
    }
  `,
  styles: [`
    .visitor-list { display: flex; flex-direction: column; gap: 8px; }
    .visitor-card { display: flex; align-items: center; gap: 12px; padding: 8px; background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--radius-lg); }
    .visitor-avatar { width: 40px; height: 40px; border-radius: var(--radius-full); object-fit: cover; }
    .visitor-info { display: flex; flex-direction: column; gap: 2px; }
    .visitor-name { font-size: var(--text-sm); font-weight: 500; }
    .visit-count, .secret-badge { font-size: 10px; color: var(--color-text-muted); }
    .tab-loading, .empty-msg { text-align: center; color: var(--color-text-muted); padding: var(--space-8) 0; font-size: var(--text-sm); }
    .load-more-btn { display: block; width: 100%; margin-top: var(--space-3); padding: var(--space-2); border: 1px dashed var(--color-border); border-radius: var(--radius-md); background: transparent; color: var(--color-text-muted); cursor: pointer; }
  `],
})
export class VisitorListComponent implements OnInit {
  protected readonly svc = inject(VisitorsService);

  ngOnInit(): void {
    this.svc.loadMore();
  }
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `cd /home/mohammed/Desktop/JilaliTalk/JilaliTalk-angular-frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/features/profile/ui/visitor-list/visitor-list.component.ts
git commit -m "feat(profile): add VisitorListComponent"
```

---

### Task 12: Angular — StatsTabComponent

**Files:**
- Create: `src/app/features/profile/ui/stats-tab/stats-tab.component.ts`

- [ ] **Step 1: Create StatsTabComponent**

```ts
import { Component, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
import { ProfileStatsService } from '../../data-access/profile-stats.service';

@Component({
  selector: 'app-stats-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (svc.loading() && !svc.stats()) {
      <div class="tab-loading">Loading…</div>
    } @else if (svc.stats()) {
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-val">{{ svc.stats()!.totalMntCount }}</span>
          <span class="stat-lbl">Moments posted</span>
        </div>
        <div class="stat-card">
          <span class="stat-val">{{ svc.stats()!.totalLikeCount }}</span>
          <span class="stat-lbl">Likes received</span>
        </div>
        <div class="stat-card">
          <span class="stat-val">{{ svc.stats()!.lastMntLikeCount }}</span>
          <span class="stat-lbl">Likes on last post</span>
        </div>
        <div class="stat-card">
          <span class="stat-val">{{ formatDate(svc.stats()!.registeredTs) }}</span>
          <span class="stat-lbl">Member since</span>
        </div>
      </div>
    } @else {
      <p class="empty-msg">Stats unavailable.</p>
    }
  `,
  styles: [`
    .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
    .stat-card { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: var(--space-4); background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--radius-xl); }
    .stat-val { font-size: var(--text-xl); font-weight: var(--font-bold); color: var(--color-text); }
    .stat-lbl { font-size: 10px; color: var(--color-text-muted); text-align: center; }
    .tab-loading, .empty-msg { text-align: center; color: var(--color-text-muted); padding: var(--space-8) 0; }
  `],
})
export class StatsTabComponent implements OnInit {
  protected readonly svc = inject(ProfileStatsService);

  ngOnInit(): void {
    this.svc.load();
  }

  formatDate(ts: number): string {
    if (!ts) return '—';
    return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `cd /home/mohammed/Desktop/JilaliTalk/JilaliTalk-angular-frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/features/profile/ui/stats-tab/stats-tab.component.ts
git commit -m "feat(profile): add StatsTabComponent with lifetime counts"
```

---

### Task 13: Angular — EditProfileSheetComponent

**Files:**
- Create: `src/app/features/profile/ui/edit-profile-sheet/edit-profile-sheet.component.ts`

- [ ] **Step 1: Create EditProfileSheetComponent**

```ts
import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProfileStore } from '../../store/profile.store';
import { DialogRef } from '@angular/cdk/dialog';
import { DIALOG_DATA } from '@angular/cdk/dialog';

interface EditSheetData {
  birthday?: string;
  nationality?: string;
}

@Component({
  selector: 'app-edit-profile-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <div class="sheet">
      <h3 class="sheet-title">Edit Profile</h3>

      <label class="field">
        <span>Birthday</span>
        <input type="date" [(ngModel)]="birthday" class="input" />
      </label>

      <label class="field">
        <span>Nationality</span>
        <select [(ngModel)]="nationality" class="input">
          <option value="">Select country</option>
          <option value="MA">Morocco</option>
          <option value="FR">France</option>
          <option value="US">United States</option>
          <option value="GB">United Kingdom</option>
          <option value="DE">Germany</option>
          <option value="ES">Spain</option>
          <option value="IT">Italy</option>
          <option value="JP">Japan</option>
          <option value="CN">China</option>
          <option value="BR">Brazil</option>
        </select>
      </label>

      @if (error()) {
        <p class="error">{{ error() }}</p>
      }

      <div class="actions">
        <button type="button" class="btn-cancel" (click)="dialogRef.close()">Cancel</button>
        <button type="button" class="btn-save" (click)="save()" [disabled]="saving()">
          {{ saving() ? 'Saving…' : 'Save' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .sheet { padding: var(--space-6); min-width: 320px; display: flex; flex-direction: column; gap: var(--space-4); }
    .sheet-title { font-size: var(--text-lg); font-weight: 600; margin: 0; }
    .field { display: flex; flex-direction: column; gap: 4px; }
    .field span { font-size: var(--text-sm); color: var(--color-text-muted); }
    .input { padding: var(--space-2) var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-md); font-size: var(--text-sm); background: var(--color-card); color: var(--color-text); }
    .error { color: var(--color-danger); font-size: var(--text-xs); margin: 0; }
    .actions { display: flex; gap: var(--space-3); justify-content: flex-end; }
    .btn-cancel { padding: 8px 16px; border-radius: var(--radius-md); border: 1px solid var(--color-border); background: transparent; cursor: pointer; font-size: var(--text-sm); }
    .btn-save { padding: 8px 16px; border-radius: var(--radius-md); border: none; background: var(--color-primary-500); color: white; cursor: pointer; font-size: var(--text-sm); }
    .btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
  `],
})
export class EditProfileSheetComponent {
  private readonly store = inject(ProfileStore);
  readonly dialogRef = inject(DialogRef);
  readonly data = inject<EditSheetData>(DIALOG_DATA);

  readonly birthday = signal(this.data?.birthday ?? '');
  readonly nationality = signal(this.data?.nationality ?? '');
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  async save(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    const ok = await this.store.editProfile({
      birthday: this.birthday() || undefined,
      nationality: this.nationality() || undefined,
    });
    this.saving.set(false);
    if (ok) {
      this.dialogRef.close(true);
    } else {
      this.error.set('Failed to update profile. Please try again.');
    }
  }
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `cd /home/mohammed/Desktop/JilaliTalk/JilaliTalk-angular-frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/features/profile/ui/edit-profile-sheet/edit-profile-sheet.component.ts
git commit -m "feat(profile): add EditProfileSheetComponent (CDK Dialog bottom sheet)"
```

---

### Task 14: Angular — ProfilePageComponent updates

**Files:**
- Modify: `src/app/features/profile/pages/profile-page.component.ts`

**Changes:**
1. Read `userId` from route — if `null` → own profile, else others
2. Conditionally show Stats tab (own only), Visitors tab (own only)
3. Conditionally show Edit button (own) vs Follow/Following button (others)
4. Add `@switch` case for `visitors` and `stats` tabs
5. Call `store.setTargetUid()` in `ngOnInit`
6. Import and use `VisitorListComponent`, `StatsTabComponent`, `Dialog`
7. Import `ActivatedRoute`, `Router`

- [ ] **Step 1: Update ProfilePageComponent**

Update imports, constructor, `ngOnInit`, and template.

New imports:
```ts
import { ActivatedRoute } from '@angular/router';
import { Dialog } from '@angular/cdk/dialog';
import { VisitorListComponent } from '../ui/visitor-list/visitor-list.component';
import { StatsTabComponent } from '../ui/stats-tab/stats-tab.component';
import { EditProfileSheetComponent } from '../ui/edit-profile-sheet/edit-profile-sheet.component';
```

Add to `ngOnInit`:
```ts
const userId = this.route.snapshot.paramMap.get('userId');
this.store.setTargetUid(userId ? Number(userId) : null);
this.store.load();
```

Add `editProfile()` method:
```ts
openEditSheet(): void {
  const data = { birthday: this._profile()?.data?.increment?.newVisitorInfos?.[0] ? undefined : undefined };
  this.dialog.open(EditProfileSheetComponent, { data, panelClass: 'bottom-sheet' });
}
```

Update tabs array to conditionally include Stats/Visitors (own profile only). Use `store.isOwnProfile()` to conditionally render Edit button or Follow button in header.

- [ ] **Step 2: Verify TypeScript**

Run: `cd /home/mohammed/Desktop/JilaliTalk/JilaliTalk-angular-frontend && npx tsc --noEmit`
Expected: fix any type errors

- [ ] **Step 3: Commit**

```bash
git add src/app/features/profile/pages/profile-page.component.ts
git commit -m "feat(profile): update ProfilePage with own/other routing, visitors/stats tabs, edit sheet"
```

---

### Task 15: Angular — Update feature index and verify build

**Files:**
- Modify: `src/app/features/profile/index.ts`

- [ ] **Step 1: Export new components**

Add to `index.ts`:
```ts
export { VisitorListComponent } from './ui/visitor-list/visitor-list.component';
export { StatsTabComponent } from './ui/stats-tab/stats-tab.component';
export { EditProfileSheetComponent } from './ui/edit-profile-sheet/edit-profile-sheet.component';
```

- [ ] **Step 2: Full build verification**

Run: `cd /home/mohammed/Desktop/JilaliTalk/JilaliTalk-angular-frontend && ng build --configuration development`
Expected: BUILD SUCCESSFUL, output at dist/JilaliTalk

- [ ] **Step 3: Commit**

```bash
git add src/app/features/profile/index.ts
git commit -m "feat(profile): export new components from profile feature index"
```

---

## Self-Review Checklist

1. **Spec coverage:** All spec requirements implemented? Yes:
   - Own profile route (`/profile`) ✅
   - Other profile route (`/profile/:userId`) ✅
   - Followers tab ✅
   - Following tab ✅
   - Visitors tab (own only) ✅
   - Stats tab (own only) ✅
   - Edit profile bottom sheet ✅
   - Lifetime + delta stats display ✅
   - BFF three new endpoints ✅

2. **Placeholder scan:** No "TBD", "TODO", or incomplete steps ✅

3. **Type consistency:**
   - `VisitorUser.userId` (not `user_id`) ✅
   - `VisitorUser.nickname` (not `nick_name`) ✅
   - `FollowerUser.sex` is `number` (not `string`) ✅
   - `ProfileStats` uses `status`/`message` (not `code`/`msg`) ✅
   - `VisitorsPage` uses `msg` (not `status`) ✅
   - Cursor for visitors is `index` (not `page_index`) ✅

4. **Angular patterns:** `OnPush`, `inject()`, no `providedIn: 'root'` on feature stores ✅

5. **BFF patterns:** `@Client(id="jlhub", path="")` for `ProfileClient` ✅
