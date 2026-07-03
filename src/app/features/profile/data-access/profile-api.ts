import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@core/tokens/api-base-url.token';
import { FollowService } from '@core/services/follow.service';
import {
  FollowResult,
  FollowersPage,
  FollowingPage,
  LikeCount,
  ProfileEditRequest,
  ProfileMe,
  ProfileStats,
  UserLang,
  UserLangsResponse,
  VisitorsPage,
} from '../models/profile.model';

@Injectable({ providedIn: 'root' })
export class ProfileApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  private readonly followService = inject(FollowService);

  readonly profileBase = `${this.base}/profile`;

  fetchMe(): Observable<ProfileMe> {
    return this.http.get<ProfileMe>(`${this.profileBase}/me`);
  }

  fetchFollowers(pageIndex = '', pageSize = 20): Observable<FollowersPage> {
    let params = new HttpParams()
      .set('lang', 'English')
      .set('page_size', pageSize);
    if (pageIndex) params = params.set('page_index', pageIndex);
    return this.http.get<FollowersPage>(`${this.profileBase}/followers`, { params });
  }

  fetchFollowing(pageIndex = '', pageSize = 20, title = ''): Observable<FollowingPage> {
    let params = new HttpParams()
      .set('lang', 'English')
      .set('focus_tab', 0)
      .set('page_size', pageSize);
    if (pageIndex) params = params.set('page_index', pageIndex);
    if (title) params = params.set('title', title);
    return this.http.get<FollowingPage>(`${this.profileBase}/following`, { params });
  }

  /** Toggles the follow relationship — see {@link FollowService} for why there's
   *  no separate `unfollow()`. Read the response's `data.status` for the outcome. */
  follow(followUid: number, nickName: string): Observable<FollowResult> {
    return this.followService.follow(followUid, nickName);
  }

  recordVisit(uid: number, visitorUid: number): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(`${this.profileBase}/visit`, {
      uid,
      visitor_uid: visitorUid,
      enter: 'profile',
    });
  }

  fetchLikeCount(uid: number): Observable<LikeCount> {
    return this.http.get<LikeCount>(`${this.profileBase}/like-count`, {
      params: new HttpParams()
        .set('lang', 'English')
        .set('terminal_type', 0)
        .set('uid', uid),
    });
  }

  fetchLangs(userId: number): Observable<UserLangsResponse> {
    return this.http.get<UserLangsResponse>(`${this.profileBase}/langs`, {
      params: new HttpParams().set('userId', userId),
    });
  }

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
}
