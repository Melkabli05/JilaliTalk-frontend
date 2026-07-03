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
 * Owns the follow/unfollow endpoints so both `core`/`shared` consumers (e.g. the
 * user-info modal) and `features/profile` can reach them without `shared` importing
 * a feature.
 * <p>
 * These are two separate upstream endpoints, not one toggle — confirmed live against
 * the real HelloTalk API (neither {@code /relation/follow}'s idempotence nor
 * {@code /relation/unfollow}'s existence appear in any {@code endpots} capture, since
 * every captured call happened to be a fresh follow). {@code POST /relation/follow} is
 * idempotent: calling it while already following just re-confirms the follow, it never
 * un-follows. Un-following requires {@code POST /relation/unfollow} with an
 * {@code unfollow_uid} field. Callers must call the method matching the direction they
 * want; there is no single call that flips state either way.
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

  unfollow(unfollowUid: number, nickName: string): Observable<FollowResult> {
    return this.http.post<FollowResult>(`${this.profileBase}/unfollow`, {
      unfollow_uid: unfollowUid,
      nick_name: nickName,
    });
  }
}
