import { Injectable, inject, signal, computed } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
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

@Injectable()
export class ProfileStore {
  private readonly api = inject(ProfileApi);
  private readonly authStore = inject(AuthStore);

  private readonly selfId = computed(() => this.authStore.user()?.userId ?? null);

  // ── Bundle (eager — the only fetch that runs on page load) ───────────────────────

  private readonly bundleRef = rxResource<ProfileBundleResponse | null, number | undefined>({
    params: () => this.selfId() ?? undefined,
    stream: ({ params }) => (params === undefined ? of(null) : this.api.bundle(params)),
    defaultValue: null,
  });

  /**
   * Seeds the bundle from a value the route resolver prefetched in parallel with
   * the lazy chunk download. Called by the page component after construction —
   * `rxResource` `defaultValue` is captured at field-initializer time (too early
   * for the resolver's value), so the page reaches into the store to inject the
   * prefetched value as the new baseline. Harmless if called twice (the resource
   * will just re-resolve with the same value).
   */
  seedBundle(value: ProfileBundleResponse | null): void {
    if (value !== null) {
      this.bundleRef.set(value);
    }
  }

  readonly bundle = this.bundleRef.value;
  readonly userInfo = computed(() => this.bundle()?.userInfo ?? null);
  readonly stats = computed(() => this.bundle()?.stats ?? null);
  readonly bundleLoading = this.bundleRef.isLoading;
  readonly bundleError = computed(() => (this.bundleRef.error() ? 'Failed to load your profile' : null));

  reloadBundle(): void {
    this.bundleRef.reload();
  }

  // ── Followers tab (lazy — only fetches once activateFollowersTab() has been called) ──

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

  // ── Following tab ──────────────────────────────────────────────────────────────

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

  // Following's pagination has no cursor param wired here (see Task 9 note): the BFF's
  // `following` call always requests page 1 at a fixed size. "Load more" for Following is
  // deliberately out of scope for this plan — see the design spec's v1 scope; a proper
  // implementation needs the same page_index cursor threading Followers has, which the
  // /following BFF endpoint doesn't currently accept as an input (it derives its own).

  // ── Visitors tab ────────────────────────────────────────────────────────────────

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

  // ── Blocked users tab ───────────────────────────────────────────────────────────

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
