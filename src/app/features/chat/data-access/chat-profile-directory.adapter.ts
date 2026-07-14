import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ProfileApi } from '@features/profile/data-access/profile-api';
import type { SocialUser, VisitorUser } from '@features/profile/models/profile.model';
import type { ChatUserSummary } from '../models/chat-message.model';
import type { ChatProfileDirectory, ChatProfilePage } from './chat.port';

@Injectable({ providedIn: 'root' })
export class ChatProfileDirectoryAdapter implements ChatProfileDirectory {
  private readonly api = inject(ProfileApi);

  async following(limit: number): Promise<ChatProfilePage> {
    const page = await firstValueFrom(this.api.following(limit));
    return {
      list: page.list.map(toUserSummary),
      more: page.more,
      pageIndex: page.pageIndex == null ? null : Number(page.pageIndex),
    };
  }

  async followers(page: number, limit: number): Promise<ChatProfilePage> {
    const pageResult = await firstValueFrom(this.api.followers(String(page), limit));
    return {
      list: pageResult.list.map(toUserSummary),
      more: pageResult.more,
      pageIndex: pageResult.pageIndex == null ? null : Number(pageResult.pageIndex),
    };
  }

  async visitors(page: number): Promise<ChatProfilePage> {
    const pageResult = await firstValueFrom(this.api.visitors(page));
    return {
      list: pageResult.list.map(toUserSummaryFromVisitor),
      more: pageResult.more,
      pageIndex: pageResult.index,
    };
  }

  async byId(userId: number): Promise<ChatUserSummary | null> {
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

function toUserSummary(u: SocialUser): ChatUserSummary {
  return {
    userId: String(u.userId),
    nickname: u.nickName ?? 'User',
    headUrl: u.headUrl,
    nationality: u.nationality,
    isMutual: u.isMutual,
  };
}

function toUserSummaryFromVisitor(u: VisitorUser): ChatUserSummary {
  return {
    userId: String(u.userid),
    nickname: u.nickname ?? 'User',
    headUrl: u.headUrl,
    nationality: u.nationality,
  };
}