// src/app/features/profile/data-access/profile-api.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '@core/tokens/api-base-url.token';
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

@Injectable({ providedIn: 'root' })
export class ProfileApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(API_BASE_URL)}/profile`;

  /** GET /api/profile/{userId}/bundle — unwrapped, no envelope to strip. */
  bundle(userId: number): Observable<ProfileBundleResponse> {
    return this.http.get<ProfileBundleResponse>(`${this.baseUrl}/${userId}/bundle`);
  }

  /** GET /api/profile/followers — cursor-paginated, status/message/data envelope. */
  followers(pageIndex: string, pageSize: number): Observable<SocialListPage> {
    const params = new HttpParams().set('pageIndex', pageIndex).set('pageSize', pageSize);
    return this.http
      .get<SocialListEnvelope>(`${this.baseUrl}/followers`, { params })
      .pipe(map((res) => res.data ?? EMPTY_SOCIAL_PAGE));
  }

  /** GET /api/profile/following — same envelope as followers; `title` is a name search,
   *  empty string for the unfiltered list. */
  following(pageSize: number, title = ''): Observable<SocialListPage> {
    const params = new HttpParams()
      .set('focusTab', 0)
      .set('pageSize', pageSize)
      .set('title', title);
    return this.http
      .get<SocialListEnvelope>(`${this.baseUrl}/following`, { params })
      .pipe(map((res) => res.data ?? EMPTY_SOCIAL_PAGE));
  }

  /**
   * POST /api/profile/visitors — msg/data envelope. The `sign` field is sent blank: live
   * testing against the real BFF confirmed this returns HTTP 200 with `{"msg":"no data
   * currently"}` rather than an error (see the design spec's Risk note) — no known signature
   * algorithm exists to compute a real one, and upstream doesn't hard-reject its absence.
   */
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

  /** GET /api/profile/blocklist — code/msg/data envelope. Every real capture returned an
   *  empty list; this call still round-trips so the tab reflects real state if that changes. */
  blocklist(): Observable<readonly BlockedUser[]> {
    return this.http
      .get<BlockListEnvelope>(`${this.baseUrl}/blocklist`)
      .pipe(map((res) => res.data?.blackList ?? []));
  }
}
