import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@core/tokens/api-base-url.token';

/**
 * `data.status` is the actual toggle result: 1 = now following, 0 = now not
 * following. It's the only reliable follow-state signal in this response —
 * `/profile/v2/userinfo` (the profile-enrichment endpoint) never returns a
 * follow/mutual flag, so this is the one place the UI learns the real state.
 */
export interface FollowResultData {
  readonly status: number;
  readonly listTimestamp: number;
  readonly limitCount: number;
  readonly createTime: number;
}

export interface FollowResult {
  readonly status: number;
  readonly message: string;
  readonly data: FollowResultData | null;
}

/**
 * Owns the follow endpoint so both `core`/`shared` consumers (e.g. the user-info
 * modal) and `features/profile` can reach it without `shared` importing a feature.
 * <p>
 * There is only one upstream endpoint, {@code POST /relation/follow} — confirmed
 * against jilalibff's {@code ProfileClient}/{@code ProfileController} and every
 * captured call in {@code endpots/organized_captures_new/relation_follow.jsonl}.
 * It's a pure toggle: calling it flips the relationship from whatever it currently
 * is upstream, with no request field to say which direction you want. A separate
 * {@code unfollow()} method here would be misleading — it'd send the identical
 * request and could just as easily *create* a follow if the caller's assumption
 * about the current state were wrong. Callers must read {@link FollowResult.data}
 * `.status` from the response (1 = now following, 0 = now not) to learn the real
 * outcome; never assume the direction from which method they called.
 */
@Injectable({ providedIn: 'root' })
export class FollowService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  private readonly profileBase = `${this.base}/profile`;

  follow(followUid: number, nickName: string): Observable<FollowResult> {
    return this.http.post<FollowResult>(`${this.profileBase}/follow`, {
      follow_uid: followUid,
      nick_name: nickName,
    });
  }
}
