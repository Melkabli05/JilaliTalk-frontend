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
