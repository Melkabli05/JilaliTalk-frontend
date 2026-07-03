import { Injectable, inject, signal, computed } from '@angular/core';
import { forkJoin } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '@core/auth/auth.store';
import { ProfileApi } from '../data-access/profile-api';
import { FollowersService } from '../data-access/followers.service';
import { FollowingService } from '../data-access/following.service';
import { ProfileStatsService } from '../data-access/profile-stats.service';
import { VisitorsService } from '../data-access/visitors.service';
import { ProfileMe, UserLang } from '../models/profile.model';

export type ProfileTab = 'followers' | 'following' | 'visitors' | 'stats';

@Injectable({ providedIn: 'root' })
export class ProfileStore {
  private readonly api = inject(ProfileApi);
  private readonly auth = inject(AuthStore);
  readonly followersSvc = inject(FollowersService);
  readonly followingSvc = inject(FollowingService);
  readonly statsSvc = inject(ProfileStatsService);
  readonly visitorsSvc = inject(VisitorsService);

  readonly activeTab = signal<ProfileTab>('followers');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  private readonly _targetUid = signal<number | null>(null);
  readonly targetUid = this._targetUid.asReadonly();

  readonly currentUid = computed(() => this.auth.user()?.userId ?? 0);
  readonly isOwnProfile = computed(() => {
    const target = this._targetUid();
    const current = this.currentUid();
    return target === null || target === current;
  });

  private readonly _profile = signal<ProfileMe | null>(null);
  readonly profile = this._profile.asReadonly();

  private readonly _langs = signal<UserLang[] | null>(null);
  readonly langs = this._langs.asReadonly();

  readonly unreadLikes = signal(0);

  /**
   * There's no endpoint that reports "does the viewer already follow this user"
   * up front (verified against jilalibff and the captured HelloTalk traffic —
   * see FollowService's doc comment), so this starts unknown-as-false and is
   * only ever set from a real toggle response's `data.status` afterward.
   */
  readonly isFollowing = signal(false);

  setTab(tab: ProfileTab): void { this.activeTab.set(tab); }
  setTargetUid(uid: number | null): void { this._targetUid.set(uid); }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    const uid = this._targetUid() ?? this.currentUid() ?? 131331894;
    try {
      const [profile, likeCount, stats, langs] = await firstValueFrom(forkJoin([
        this.api.fetchMe(),
        this.api.fetchLikeCount(uid),
        this.api.fetchStats(),
        this.api.fetchLangs(uid),
      ]));
      this._profile.set(profile);
      this.unreadLikes.set(likeCount?.data?.unreadFavorCount ?? 0);
      this.statsSvc.setStats(stats.data);
      this._langs.set(langs?.data ?? null);
      void this.followersSvc.loadMore();
      void this.followingSvc.loadMore();
      void this.visitorsSvc.loadMore();
    } catch {
      this.error.set('Failed to load profile');
    } finally {
      this.loading.set(false);
    }
  }

  async editProfile(data: { birthday?: string; nationality?: string }): Promise<boolean> {
    try {
      const r = await firstValueFrom(this.api.editProfile(data));
      return r.status === 0;
    } catch { return false; }
  }

  reset(): void {
    this._profile.set(null);
    this._langs.set(null);
    this.error.set(null);
    this.unreadLikes.set(0);
    this.activeTab.set('followers');
    this.followersSvc.reset();
    this.followingSvc.reset();
    this.statsSvc.reset();
    this.visitorsSvc.reset();
  }
}
