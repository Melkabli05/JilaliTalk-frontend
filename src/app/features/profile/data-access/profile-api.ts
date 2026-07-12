import { Service, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '@core/tokens/api-base-url.token';
import type { UserInfo } from '@core/services/user-info.service';
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
@Service()
export class ProfileApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(API_BASE_URL)}/profile`;

  bundle(userId: number): Observable<ProfileBundleResponse> {
    return this.http.get<ProfileBundleResponse>(`${this.baseUrl}/${userId}/bundle`);
  }

  followers(pageIndex: string, pageSize: number): Observable<SocialListPage> {
    const params = new HttpParams().set('pageIndex', pageIndex).set('pageSize', pageSize);
    return this.http
      .get<SocialListEnvelope>(`${this.baseUrl}/followers`, { params })
      .pipe(map((res) => res.data ?? EMPTY_SOCIAL_PAGE));
  }

  following(pageSize: number, title = ''): Observable<SocialListPage> {
    const params = new HttpParams()
      .set('focusTab', 0)
      .set('pageSize', pageSize)
      .set('title', title);
    return this.http
      .get<SocialListEnvelope>(`${this.baseUrl}/following`, { params })
      .pipe(map((res) => res.data ?? EMPTY_SOCIAL_PAGE));
  }

  /** The visitors endpoint's request envelope mirrors the mobile client's own request shape
   *  (device/client metadata fields the backend expects on this specific endpoint) rather
   *  than a plain `{ index }` body — `device_type`/`client_ver`/etc. are static placeholders
   *  identifying this as the web client, not per-request state. */
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

  blocklist(): Observable<readonly BlockedUser[]> {
    return this.http
      .get<BlockListEnvelope>(`${this.baseUrl}/blocklist`)
      .pipe(map((res) => res.data?.blackList ?? []));
  }

  /**
   * Single-user profile lookup. Mirrors the BFF's {@code GET /api/users/info?userId=N}.
   * Used by the messages new-contact panel's "By ID" tab.
   */
  userInfo(userId: number): Observable<UserInfo> {
    const params = new HttpParams().set('userId', userId);
    return this.http.get<UserInfo>(`${this.baseUrl}/info`, { params });
  }
}
