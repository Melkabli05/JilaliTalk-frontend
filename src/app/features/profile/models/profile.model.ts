
import { UserInfo } from '@core/services/user-info.service';
interface ProfileStats {
  readonly totalMntCount: number | null;
  readonly totalLikeCount: number | null;
  readonly lastMntLikeCount: number | null;
  readonly lastMntPostTs: number | null;
  readonly registeredTs: number | null;
}
interface ProfileTagLimit {
  readonly hobbyLmit: number | null;
  readonly travellingLmit: number | null;
  readonly hometownLmit: number | null;
  readonly educationLmit: number | null;
  readonly occupationLmit: number | null;
  readonly mbtiLmit: number | null;
  readonly zodiacSignLimit: number | null;
  readonly bloodTypeLimit: number | null;
}
interface ProfileLangLimit {
  readonly limitDays: number | null;
  readonly nextModifyTs: number | null;
}
interface ProfileLimitations {
  readonly tagLimit: ProfileTagLimit | null;
  readonly langLimit: ProfileLangLimit | null;
  readonly modifyNationality: boolean;
  readonly modifyGender: boolean;
  readonly modifyBirthday: boolean;
  readonly modifyBirthdayByAdmin: boolean;
  readonly isModifyRestricted: boolean;
}
export interface ProfileBundleResponse {
  readonly userInfo: UserInfo;
  readonly isOwnProfile: boolean;
  readonly stats: ProfileStats | null;
  readonly limitations: ProfileLimitations | null;
}
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
export interface SocialListEnvelope {
  readonly status: number;
  readonly message: string | null;
  readonly data: SocialListPage | null;
}
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
