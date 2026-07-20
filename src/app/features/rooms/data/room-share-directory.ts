import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ProfileApi } from '@features/profile/data-access/profile-api';
import type { SocialUser, VisitorUser } from '@features/profile/models/profile.model';
import type { UserSummary } from '@shared/ui/user-picker-sheet/user-picker-sheet.model';

export interface RoomSharePage {
  readonly list: readonly UserSummary[];
  readonly more: boolean;
  readonly pageIndex: number | null;
}

/**
 * Feeds the shared UserPickerSheetComponent for the "share this room with a user" flow —
 * same following/followers/visitors/by-ID directory chat's ChatProfileDirectoryAdapter
 * already exposes, duplicated here rather than shared because a per-feature adapter is a
 * few lines of mapping glue, while the actual reusable pieces (the picker UI, the DM send
 * call) already live in shared/core. ProfileApi itself is already imported directly by
 * chat's own adapter (features/chat/data-access/chat-profile-directory.adapter.ts), so this
 * follows the same established pattern rather than inventing a new one.
 */
@Service()
export class RoomShareDirectory {
  private readonly api = inject(ProfileApi);

  async following(limit: number): Promise<RoomSharePage> {
    const page = await firstValueFrom(this.api.following(limit));
    return {
      list: page.list.map(toUserSummary),
      more: page.more,
      pageIndex: page.pageIndex == null ? null : Number(page.pageIndex),
    };
  }

  async followers(page: number, limit: number): Promise<RoomSharePage> {
    const pageResult = await firstValueFrom(this.api.followers(String(page), limit));
    return {
      list: pageResult.list.map(toUserSummary),
      more: pageResult.more,
      pageIndex: pageResult.pageIndex == null ? null : Number(pageResult.pageIndex),
    };
  }

  async visitors(page: number): Promise<RoomSharePage> {
    const pageResult = await firstValueFrom(this.api.visitors(page));
    return {
      list: pageResult.list.map(toUserSummaryFromVisitor),
      more: pageResult.more,
      pageIndex: pageResult.index,
    };
  }

  async byId(userId: number): Promise<UserSummary | null> {
    const info = await firstValueFrom(this.api.userInfo(userId));
    if (!info) return null;
    return {
      userId: String(info.userId),
      nickname: info.nickname ?? info.username ?? 'User',
      headUrl: info.details?.base?.headUrl ?? null,
      nationality: info.nationality ?? info.details?.base?.nationality ?? null,
    };
  }
}

function toUserSummary(u: SocialUser): UserSummary {
  return {
    userId: String(u.userId),
    nickname: u.nickName ?? 'User',
    headUrl: u.headUrl,
    nationality: u.nationality,
    isMutual: u.isMutual,
  };
}

function toUserSummaryFromVisitor(u: VisitorUser): UserSummary {
  return {
    userId: String(u.userid),
    nickname: u.nickname ?? 'User',
    headUrl: u.headUrl,
    nationality: u.nationality,
  };
}
