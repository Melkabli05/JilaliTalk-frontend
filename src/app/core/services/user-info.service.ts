import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '@core/tokens/api-base-url.token';

/** One entry of `base.teachLangs` / `base.learnLangs`. */
export interface UserLangInfo {
  readonly langId: number | null;
  readonly level: number | null;
  readonly shortName: string | null;
  readonly fullName: string | null;
}

/** Misc VIP/account flags nested under `base.userExtraInfo`. */
export interface UserExtraInfo {
  readonly hideVipIdentity: number | null;
  readonly isExpert: boolean | null;
  readonly isNewUser: boolean | null;
  readonly vipPlusExpireTs: number | null;
  readonly vipPlusLogo: string | null;
  readonly vipPlusLogoAnim: string | null;
}

/** Core profile fields — the bulk of what a profile card would show. */
export interface UserProfileBase {
  readonly username: string | null;
  readonly nickname: string | null;
  readonly fullPy: string | null;
  readonly shortPy: string | null;
  readonly nativeLang: number | null;
  readonly accountType: string | null;
  readonly userType: number | null;
  readonly sex: number | null;
  readonly nationality: string | null;
  readonly birthday: string | null;
  readonly age: number | null;
  readonly signature: string | null;
  readonly timezone: number | null;
  readonly timezone48: number | null;
  readonly regTime: number | null;
  readonly regDays: number | null;
  readonly teachLangs: readonly UserLangInfo[] | null;
  readonly learnLangs: readonly UserLangInfo[] | null;
  readonly headUrl: string | null;
  readonly voiceUrl: string | null;
  readonly voiceDuration: number | null;
  readonly userinfoTs: number | null;
  readonly coverPictureUrl: string | null;
  readonly photoCoverUrl: string | null;
  readonly vipType: number | null;
  readonly vipExpireTime: number | null;
  readonly vipLogo: string | null;
  readonly vipLogoAnim: string | null;
  readonly hwVip: boolean | null;
  readonly englishAiVip: boolean | null;
  readonly rippleAnimUrl: string | null;
  readonly rippleThumb: string | null;
  readonly languageAiVip: boolean | null;
  readonly bubbleAnimalUrlDark: string | null;
  readonly bubbleTextColorDark: string | null;
  readonly bubbleAnimalUrl: string | null;
  readonly bubbleTextColor: string | null;
  readonly bubbleId: number | null;
  readonly userExtraInfo: UserExtraInfo | null;
}

/** Learning/translation point tallies. */
export interface UserPointsInfo {
  readonly collect: number | null;
  readonly correct: number | null;
  readonly exchange: number | null;
  readonly read: number | null;
  readonly speechToText: number | null;
  readonly textTranslate: number | null;
  readonly transliterate: number | null;
  readonly word: number | null;
  readonly translate: number | null;
}

/** One tag chip (hobby, occupation, MBTI, zodiac sign, etc.). */
export interface UserTagItem {
  readonly tagId: number | null;
  readonly tid: number | null;
  readonly type: number | null;
  readonly cate: number | null;
  readonly tag: string | null;
  readonly icon: string | null;
}

export interface UserTagsInfo {
  readonly hobby: readonly UserTagItem[] | null;
  readonly occupation: readonly UserTagItem[] | null;
  readonly education: readonly UserTagItem[] | null;
  readonly hometown: readonly UserTagItem[] | null;
  readonly travelling: readonly UserTagItem[] | null;
  readonly mbti: readonly UserTagItem[] | null;
  readonly zodiacSign: readonly UserTagItem[] | null;
  readonly bloodType: readonly UserTagItem[] | null;
}

export interface UserLocationInfo {
  readonly allowLocation: number | null;
  readonly city: string | null;
  readonly fullCountry: string | null;
  readonly countryCode: string | null;
  readonly longitude: string | null;
  readonly latitude: string | null;
  readonly mapLat: string | null;
  readonly mapLng: string | null;
  readonly gotoMapUrl: string | null;
  readonly mapImageUrl: string | null;
  readonly imageUrl: string | null;
  readonly updateTs: number | null;
  readonly forceShow: number | null;
  readonly addrId: string | null;
  readonly searchCityVal: string | null;
}

export interface UserRelationInfo {
  readonly followers: number | null;
  readonly following: number | null;
  readonly likes: number | null;
  readonly moments: number | null;
  readonly comments: number | null;
  readonly visitors: number | null;
  readonly recentVisitors: number | null;
  readonly invisibleVisitors: number | null;
  readonly momentViewCount: number | null;
}

export interface UserPrivilegesInfo {
  readonly hideAge: number | null;
  readonly hideCity: number | null;
  readonly hideOnline: number | null;
  readonly hideLocation: number | null;
  readonly hideLiveStatus: number | null;
  readonly hideWebProfile: number | null;
  readonly privileges: number | null;
  readonly showZodiacSign: number | null;
}

export interface UserOnlineStateInfo {
  readonly onlineState: number | null;
  readonly areaCode: string | null;
  readonly terminalType: number | null;
  readonly onlineTs: number | null;
}

export interface UserLiveStateInfo {
  readonly statusType: number | null;
  readonly cname: string | null;
}

export interface UserDefaultInfo {
  readonly consecutiveDays: number | null;
  readonly isScammer: number | null;
  readonly profileShareUrl: string | null;
  readonly userFlag: number | null;
}

export interface UserPayInfo {
  readonly backgroundType: number | null;
  readonly background: string | null;
  readonly backgroundBlack: string | null;
  readonly medalIcon: string | null;
}

export interface UserRemarkInfo {
  readonly remarkFullPy: string | null;
  readonly remarkShortPy: string | null;
  readonly remarkName: string | null;
  readonly remarkInfo: string | null;
}

/** The full upstream profile (`UserInfo.details`) — everything the flattened top-level fields
 *  summarize, for clients that need more (avatars, languages, tags, vip status, etc.). */
export interface UserProfileDetails {
  readonly userId: number;
  readonly base: UserProfileBase | null;
  readonly points: UserPointsInfo | null;
  readonly tags: UserTagsInfo | null;
  readonly location: UserLocationInfo | null;
  readonly relation: UserRelationInfo | null;
  readonly privileges: UserPrivilegesInfo | null;
  readonly onlineState: UserOnlineStateInfo | null;
  readonly liveState: UserLiveStateInfo | null;
  readonly default: UserDefaultInfo | null;
  readonly giftLevel: number | null;
  readonly payInfo: UserPayInfo | null;
  readonly remark: UserRemarkInfo | null;
}

export interface UserInfo {
  readonly userId: number;
  readonly username: string | null;
  readonly nickname: string | null;
  readonly birthday: string | null;
  readonly accountType: string | null;
  readonly fullPy: string | null;
  readonly age: number | null;
  readonly sex: string | null;
  readonly nationality: string | null;
  readonly city: string | null;
  readonly fullCountry: string | null;
  readonly areaCode: string | null;
  readonly regDays: number | null;
  readonly liveStateCname: string | null;
  /** Pre-computed sum of the six contribution point categories, from the BFF. */
  readonly pointsTotal: number;
  /** Pre-flattened tag chips (hobby / occupation / MBTI / etc.) — the BFF folds the eight
   *  upstream `TagsInfo.*` arrays into one flat list so the modal doesn't have to. */
  readonly tags: readonly string[] | null;
  /** Full upstream profile — avatars, languages, tags, vip status, etc. */
  readonly details: UserProfileDetails | null;
}

/** Response shape of `POST /users/enrich-batch`. */
export interface EnrichBatchResponse {
  readonly profiles: readonly UserInfo[];
}

/**
 * Per-user presence — where this user is right now, if anywhere.
 * Mirrors the BFF's `UserStatus` DTO shape from `GET /api/users/{userId}/status`.
 * {@link statusType} values:
 *   0 — not in any room
 *   1 — hosting their own room (cname starts with {@code LS_})
 *   2 — in someone else's room as a guest (cname starts with {@code VR_})
 * When {@code statusType === 1 || 2}, {@link cname} identifies the room they're in and
 * {@link roomName} is its human-readable name; otherwise both are null/empty.
 */
export interface UserPresence {
  readonly userId: number;
  readonly statusType: number;
  readonly cname: string | null;
  readonly roomName: string | null;
  readonly roomId: string | null;
  readonly hostId: number;
  readonly hostName: string | null;
  readonly hostNationality: string | null;
  /** Avatar URL — present in every captured response with statusType 1 or 2. Empty/null
   *  when statusType is 0 (offline). Lets the banner show the host's avatar without a
   *  second HTTP round trip. */
  readonly headUrl: string | null;
  readonly giftLevel: number | null;
  readonly blackened: boolean;
}

const STALE_AFTER_MS = 5 * 60 * 1000; // 5 minutes — matches the room heartbeat cadence's order of magnitude
const PRESENCE_STALE_AFTER_MS = 60 * 1000; // 1 minute — presence flips every room join/leave

/**
 * Caching lives on the backend only: the BFF's `/api/users/info` caches server-side for 24h
 * of inactivity (Caffeine, time-to-idle) to skip the expensive Curve25519 handshake, so a call
 * from here is cheap even on the BFF's own miss. `fetchUserInfo()` therefore never skips the
 * HTTP call for a uid it's already seen — every call reaches the BFF.
 * <p>
 * The `_cache` map below is not a cache in that sense: it's the single shared store of "the
 * most recently fetched value per uid", read synchronously via {@link getUserInfo} inside
 * `computed()` signals (the user-info modal, event-card enrichment, ghost-audience roster) so
 * the UI can reactively update once an async fetch resolves — signals can't `await`, so
 * something has to hold the latest value for them to read.
 */
@Injectable({ providedIn: 'root' })
export class UserInfoService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(API_BASE_URL)}/users`;

  private readonly _cache = signal<ReadonlyMap<number, { readonly info: UserInfo; readonly fetchedAt: number }>>(new Map());
  private readonly _loading = signal(false);
  // Tracks in-flight fetch promises so concurrent requests for the same uid
  // are deduplicated — only one HTTP call per uid runs at a time.
  private readonly _pendingFetches = new Map<number, Promise<UserInfo | null>>();
  // Presence is cached separately and kept for 60s — shorter than the user-info cache
  // because presence flips every time a user joins/leaves a room.
  private readonly _presenceCache = signal<ReadonlyMap<number, { readonly presence: UserPresence; readonly fetchedAt: number }>>(new Map());
  private readonly _pendingPresenceFetches = new Map<number, Promise<UserPresence | null>>();

  readonly loading = this._loading.asReadonly();

  getUserInfo(userId: number): UserInfo | null {
    return this._cache().get(userId)?.info ?? null;
  }

  /** True if `userId` has never been fetched, or its cached entry is older than the TTL. */
  isStale(userId: number): boolean {
    const entry = this._cache().get(userId);
    return !entry || Date.now() - entry.fetchedAt > STALE_AFTER_MS;
  }

  getUserPresence(userId: number): UserPresence | null {
    return this._presenceCache().get(userId)?.presence ?? null;
  }

  /** True if presence for `userId` has never been fetched, or its cached entry is older than the TTL. */
  isPresenceStale(userId: number): boolean {
    const entry = this._presenceCache().get(userId);
    return !entry || Date.now() - entry.fetchedAt > PRESENCE_STALE_AFTER_MS;
  }

  async fetchUserPresence(userId: number): Promise<UserPresence | null> {
    if (!(userId > 0) || !Number.isFinite(userId)) return null;
    // Deduplicate: if a presence fetch for this uid is already in flight, await it.
    const existing = this._pendingPresenceFetches.get(userId);
    if (existing) return existing;
    const promise = this.doFetchPresence(userId);
    this._pendingPresenceFetches.set(userId, promise);
    try {
      return await promise;
    } finally {
      this._pendingPresenceFetches.delete(userId);
    }
  }

  async fetchUserInfo(userId: number): Promise<UserInfo | null> {
    if (!(userId > 0) || !Number.isFinite(userId)) return null;
    // Deduplicate: if a fetch for this uid is already in flight, await it instead of
    // firing a second HTTP request.
    const existing = this._pendingFetches.get(userId);
    if (existing) {
      return existing;
    }
    const promise = this.doFetch(userId);
    this._pendingFetches.set(userId, promise);
    try {
      return await promise;
    } finally {
      this._pendingFetches.delete(userId);
    }
  }

  /**
   * Triggers a re-fetch only if the cached entry is missing or stale (see isStale).
   * Fire-and-forget — callers read the result reactively via getUserInfo(), matching how
   * fetchUserInfo() is already used at every existing call site.
   */
  ensureFresh(userId: number): void {
    if (!(userId > 0)) return;
    if (!this.getUserInfo(userId) || this.isStale(userId)) {
      void this.fetchUserInfo(userId);
    }
  }

  /**
   * Batch-fetches profiles for multiple uids in one round trip (`POST /users/enrich-batch`)
   * and primes the cache with the results, so a subsequent `getUserInfo()` for any of those
   * uids returns the enriched value. Callers that queue uids from bursty realtime events
   * (audience/stage rosters, comment event cards, IM notifications) should batch through this
   * — via `EnrichBatchQueue` (`shared/utils`) — rather than call `fetchUserInfo` per uid.
   */
  async enrichBatchAndCache(userIds: readonly number[]): Promise<readonly UserInfo[]> {
    if (userIds.length === 0) return [];
    const { profiles } = await firstValueFrom(
      this.http.post<EnrichBatchResponse>(`${this.baseUrl}/enrich-batch`, { userIds }),
    );
    this.primeCache(profiles);
    return profiles;
  }

  /** Merges externally-fetched profiles into the cache without an HTTP call of its own. */
  primeCache(profiles: readonly UserInfo[]): void {
    if (profiles.length === 0) return;
    const now = Date.now();
    this._cache.update((map) => {
      const next = new Map(map);
      for (const profile of profiles) next.set(profile.userId, { info: profile, fetchedAt: now });
      return next;
    });
  }

  private async doFetch(userId: number): Promise<UserInfo | null> {
    this._loading.set(true);
    try {
      const info = await firstValueFrom(
        this.http.get<UserInfo>(`${this.baseUrl}/info`, { params: { userId } }),
      );
      const resolved = info ?? ({} as UserInfo);
      // Keyed by the requested userId explicitly, not resolved.userId — the fallback `{}`
      // has no userId field, so primeCache (which keys off profile.userId) can't be reused here.
      this._cache.update((map) => new Map(map).set(userId, { info: resolved, fetchedAt: Date.now() }));
      return resolved;
    } catch {
      return null;
    } finally {
      this._loading.set(false);
    }
  }

  private async doFetchPresence(userId: number): Promise<UserPresence | null> {
    try {
      const raw = await firstValueFrom(
        this.http.get<{
          userStatusType: number;
          userId: number;
          roomId?: string | null;
          roomName?: string | null;
          hostId?: number | null;
          hostName?: string | null;
          hostNationality?: string | null;
          cname?: string | null;
          headUrl?: string | null;
          giftLevel?: number | null;
          blackened: boolean;
        }>(`${this.baseUrl}/${userId}/status`),
      );
      const presence: UserPresence = {
        userId,
        statusType: raw.userStatusType,
        cname: raw.cname ?? null,
        roomName: raw.roomName ?? null,
        roomId: raw.roomId ?? null,
        // `hostId` arrives as a number on the wire today, but the BFF DTO now types it
        // as nullable to absorb any future upstream null. Coalesce missing → 0 here so
        // the existing `hostId > 0` call sites keep working unchanged.
        hostId: raw.hostId ?? 0,
        hostName: raw.hostName ?? null,
        hostNationality: raw.hostNationality ?? null,
        headUrl: raw.headUrl ?? null,
        giftLevel: raw.giftLevel ?? null,
        blackened: raw.blackened,
      };
      this._presenceCache.update((map) => new Map(map).set(userId, { presence, fetchedAt: Date.now() }));
      return presence;
    } catch {
      return null;
    }
  }
}