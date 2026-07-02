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
  /** Full upstream profile — avatars, languages, tags, vip status, etc. */
  readonly details: UserProfileDetails | null;
}

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

  private readonly _cache = signal<ReadonlyMap<number, UserInfo>>(new Map());
  private readonly _loading = signal(false);
  // Tracks in-flight fetch promises so concurrent requests for the same uid
  // are deduplicated — only one HTTP call per uid runs at a time.
  private readonly _pendingFetches = new Map<number, Promise<UserInfo | null>>();

  readonly loading = this._loading.asReadonly();

  getUserInfo(userId: number): UserInfo | null {
    return this._cache().get(userId) ?? null;
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

  private async doFetch(userId: number): Promise<UserInfo | null> {
    this._loading.set(true);
    try {
      const info = await firstValueFrom(
        this.http.get<UserInfo>(`${this.baseUrl}/info`, { params: { userId } }),
      );
      const resolved = info ?? ({} as UserInfo);
      this._cache.update((map) => {
        const next = new Map(map);
        next.set(userId, resolved);
        return next;
      });
      return resolved;
    } catch {
      return null;
    } finally {
      this._loading.set(false);
    }
  }
}