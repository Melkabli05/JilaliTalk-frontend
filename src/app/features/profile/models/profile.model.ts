export interface VisitorInfo {
  readonly userId: number;
  readonly headUrl: string | null;
  readonly nationality: string | null;
}

export interface Increment {
  readonly newFollowerCount: number;
  readonly newVisitorCount: number;
  readonly newProfileLikeCount: number;
  readonly newProfileLikePeople: number;
  readonly newVisitorInfos: VisitorInfo[] | null;
}

export interface ProfileMe {
  readonly code: number;
  readonly msg: string;
  readonly data: ProfileMeData | null;
}

export interface ProfileMeData {
  readonly user: ProfileUser | null;
  readonly increment: Increment | null;
  readonly visitor: { readonly recentVisitors: VisitorInfo[] | null } | null;
  readonly isRealAuth: boolean;
}

export interface ProfileUser {
  readonly userId: number;
  readonly nickName: string | null;
  readonly headUrl: string | null;
  readonly nationality: string | null;
  readonly vipType: number;
  readonly sex: number;
  readonly email: string | null;
}

export interface FollowerUser {
  readonly userId: number;
  readonly username?: string;
  readonly sex: number;
  readonly nationality: string | null;
  readonly headUrl: string | null;
  readonly nickName: string | null;
  readonly nativeLang: number | null;
  readonly vipType: number | null;
  readonly giftLevel: number;
  readonly remarkName: string | null;
  readonly isMutual: boolean;
}

export interface FollowersPage {
  readonly status: number;
  readonly message: string;
  readonly data: FollowersData | null;
}

export interface FollowersData {
  readonly pageIndex: string;
  readonly more: boolean;
  readonly count: number;
  readonly pinnedStat: { readonly limit: number; readonly cnt: number } | null;
  readonly list: FollowerUser[];
}

export interface FollowingPage {
  readonly status: number;
  readonly message: string;
  readonly data: FollowingData | null;
}

export interface FollowingData {
  readonly pageIndex: string;
  readonly more: boolean;
  readonly count: number;
  readonly pinnedStat: { readonly limit: number; readonly cnt: number } | null;
  readonly list: FollowerUser[];
}

export type { FollowResult } from '@core/services/follow.service';

export interface LikeCount {
  readonly status: number;
  readonly message: string;
  readonly data: LikeCountData | null;
}

export interface LikeCountData {
  readonly unreadFavorCount: number;
  readonly unreadFavorPeople: number;
}

export interface UserLangsResponse {
  readonly code: number;
  readonly msg: string;
  readonly data: UserLang[] | null;
}

export interface UserLang {
  readonly lang: number;
  readonly isTemp: number;
  readonly isExpiredVipSelfSetLang: number;
}

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

export interface VisitorsPage {
  readonly msg: string;
  readonly data: VisitorsData | null;
}

export interface VisitorsData {
  readonly index: number;
  readonly more: boolean;
  readonly list: VisitorUser[];
}

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

export interface ProfileEditRequest {
  readonly birthday?: string;
  readonly nationality?: string;
  readonly osType?: number;
  readonly version?: string;
}