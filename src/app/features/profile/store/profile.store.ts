import { Service, inject, signal, computed } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { ProfileApi } from '../data-access/profile-api';
import { AuthStore } from '@core/auth/auth.store';
import {
  ProfileBundleResponse,
  SocialListPage,
  VisitorsPage,
  BlockedUser,
} from '../models/profile.model';
const EMPTY_SOCIAL_PAGE: SocialListPage = { pageIndex: null, more: false, count: 0, list: [] };
const EMPTY_VISITORS_PAGE: VisitorsPage = { index: null, more: false, list: [] };
const FOLLOWERS_PAGE_SIZE = 20;
const FOLLOWING_PAGE_SIZE = 20;
// Page-scoped: only profile-page.component.ts injects this, via its own
// `providers: [ProfileStore]` (see CLAUDE.md §7).
@Service({ autoProvided: false })
export class ProfileStore {
  private readonly api = inject(ProfileApi);
  private readonly authStore = inject(AuthStore);
  private readonly route = inject(ActivatedRoute);
  private readonly selfId = computed(() => this.authStore.user()?.userId ?? null);

  private readonly _bundle = signal<ProfileBundleResponse | null>(
    (this.route.snapshot.data['bundle'] as ProfileBundleResponse | null | undefined) ?? null,
  );
  private readonly bundleRef = rxResource<ProfileBundleResponse | null, number | undefined>({
    params: () => (this._bundle() !== null ? undefined : this.selfId() ?? undefined),
    stream: ({ params }) => (params === undefined ? of(null) : this.api.bundle(params)),
    defaultValue: null,
  });

  readonly bundle = computed<ProfileBundleResponse | null>(() => this._bundle() ?? this.bundleRef.value());
  readonly userInfo = computed(() => this.bundle()?.userInfo ?? null);
  readonly stats = computed(() => this.bundle()?.stats ?? null);
  readonly bundleLoading = computed(
    () => this._bundle() === null && this.bundleRef.isLoading(),
  );
  readonly bundleError = computed(() => (this.bundleRef.error() ? 'Failed to load your profile' : null));
  reloadBundle(): void {
    this._bundle.set(null);
    this.bundleRef.reload();
  }

  private readonly _followersTabActive = signal(false);
  private readonly _followersCursor = signal<string>('');
  private readonly followersRef = rxResource<SocialListPage, { cursor: string } | undefined>({
    params: () => (this._followersTabActive() ? { cursor: this._followersCursor() } : undefined),
    stream: ({ params }) =>
      params === undefined ? of(EMPTY_SOCIAL_PAGE) : this.api.followers(params.cursor, FOLLOWERS_PAGE_SIZE),
    defaultValue: EMPTY_SOCIAL_PAGE,
  });
  readonly followers = computed(() => this.followersRef.value().list);
  readonly followersMore = computed(() => this.followersRef.value().more);
  readonly followersLoading = this.followersRef.isLoading;
  readonly followersError = computed(() => (this.followersRef.error() ? 'Failed to load followers' : null));
  activateFollowersTab(): void {
    this._followersTabActive.set(true);
  }
  loadMoreFollowers(): void {
    const next = this.followersRef.value().pageIndex;
    if (next) this._followersCursor.set(next);
  }

  private readonly _followingTabActive = signal(false);
  private readonly followingRef = rxResource<SocialListPage, true | undefined>({
    params: () => (this._followingTabActive() ? true : undefined),
    stream: ({ params }) =>
      params === undefined ? of(EMPTY_SOCIAL_PAGE) : this.api.following(FOLLOWING_PAGE_SIZE),
    defaultValue: EMPTY_SOCIAL_PAGE,
  });
  readonly following = computed(() => this.followingRef.value().list);
  readonly followingMore = computed(() => this.followingRef.value().more);
  readonly followingLoading = this.followingRef.isLoading;
  readonly followingError = computed(() => (this.followingRef.error() ? 'Failed to load following' : null));
  activateFollowingTab(): void {
    this._followingTabActive.set(true);
  }

  private readonly _visitorsTabActive = signal(false);
  private readonly _visitorsCursor = signal(0);
  private readonly visitorsRef = rxResource<VisitorsPage, { index: number } | undefined>({
    params: () => (this._visitorsTabActive() ? { index: this._visitorsCursor() } : undefined),
    stream: ({ params }) =>
      params === undefined ? of(EMPTY_VISITORS_PAGE) : this.api.visitors(params.index),
    defaultValue: EMPTY_VISITORS_PAGE,
  });
  readonly visitors = computed(() => this.visitorsRef.value().list);
  readonly visitorsMore = computed(() => this.visitorsRef.value().more);
  readonly visitorsLoading = this.visitorsRef.isLoading;
  readonly visitorsError = computed(() => (this.visitorsRef.error() ? 'Failed to load visitors' : null));
  activateVisitorsTab(): void {
    this._visitorsTabActive.set(true);
  }
  loadMoreVisitors(): void {
    const next = this.visitorsRef.value().index;
    if (next != null) this._visitorsCursor.set(next);
  }

  private readonly _blockedTabActive = signal(false);
  private readonly blockedRef = rxResource<readonly BlockedUser[], true | undefined>({
    params: () => (this._blockedTabActive() ? true : undefined),
    stream: ({ params }) => (params === undefined ? of([]) : this.api.blocklist()),
    defaultValue: [],
  });
  readonly blocked = this.blockedRef.value;
  readonly blockedLoading = this.blockedRef.isLoading;
  readonly blockedError = computed(() => (this.blockedRef.error() ? 'Failed to load blocked users' : null));
  activateBlockedTab(): void {
    this._blockedTabActive.set(true);
  }
}
