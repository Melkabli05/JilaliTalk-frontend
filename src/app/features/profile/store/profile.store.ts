import { Service, inject, signal, computed, DestroyRef } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { ProfileApi } from '../data-access/profile-api';
import { AuthStore } from '@core/auth/auth.store';
import {
  ProfileBundleResponse,
  SocialListPage,
  SocialUser,
  VisitorUser,
  BlockedUser,
} from '../models/profile.model';
const EMPTY_SOCIAL_PAGE: SocialListPage = { pageIndex: null, more: false, count: 0, list: [] };
const FOLLOWERS_PAGE_SIZE = 20;
// Page-scoped: only profile-page.component.ts injects this, via its own
// `providers: [ProfileStore]` (see CLAUDE.md §7).
@Service({ autoProvided: false })
export class ProfileStore {
  private readonly api = inject(ProfileApi);
  private readonly authStore = inject(AuthStore);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
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

  /**
   * Followers and visitors are cursor-paginated lists with a "Load more" button, not a
   * single page — `rxResource` (used everywhere else in this store) replaces its `value()`
   * on every params change, which is right for "refetch the same thing" but wrong for
   * "append the next page": swapping the cursor would have silently replaced the visible
   * list with just the next page instead of growing it. These two lists accumulate pages
   * into their own signal instead, following the same manual-fetch pattern already used for
   * `messages`'s new-contact-panel visitors tab, which has the identical accumulation need.
   */
  private readonly _followers = signal<readonly SocialUser[]>([]);
  private readonly _followersCursor = signal('');
  private readonly _followersMore = signal(false);
  private readonly _followersLoading = signal(false);
  private readonly _followersError = signal<string | null>(null);
  private followersActivated = false;

  readonly followers = this._followers.asReadonly();
  readonly followersMore = this._followersMore.asReadonly();
  readonly followersLoading = this._followersLoading.asReadonly();
  readonly followersError = this._followersError.asReadonly();

  activateFollowersTab(): void {
    if (this.followersActivated) return;
    this.followersActivated = true;
    this.fetchFollowers(true);
  }
  loadMoreFollowers(): void {
    if (this._followersLoading()) return;
    this.fetchFollowers(false);
  }
  private fetchFollowers(reset: boolean): void {
    this._followersLoading.set(true);
    this._followersError.set(null);
    const cursor = reset ? '' : this._followersCursor();
    this.api.followers(cursor, FOLLOWERS_PAGE_SIZE)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this._followers.update((acc) => (reset ? page.list : [...acc, ...page.list]));
          this._followersCursor.set(page.pageIndex ?? '');
          this._followersMore.set(page.more);
          this._followersLoading.set(false);
        },
        error: () => {
          this._followersLoading.set(false);
          this._followersError.set('Failed to load followers');
        },
      });
  }

  private readonly _followingTabActive = signal(false);
  private readonly followingRef = rxResource<SocialListPage, true | undefined>({
    params: () => (this._followingTabActive() ? true : undefined),
    stream: ({ params }) =>
      params === undefined ? of(EMPTY_SOCIAL_PAGE) : this.api.following(FOLLOWERS_PAGE_SIZE),
    defaultValue: EMPTY_SOCIAL_PAGE,
  });
  /** No "load more" for following — `ProfileApi.following` doesn't accept a cursor, so this
   *  tab only ever shows the first page (matches what the API actually supports; the old
   *  `followingMore` signal implied pagination that didn't exist and was never read by the
   *  template). */
  readonly following = computed(() => this.followingRef.value().list);
  readonly followingLoading = this.followingRef.isLoading;
  readonly followingError = computed(() => (this.followingRef.error() ? 'Failed to load following' : null));
  activateFollowingTab(): void {
    this._followingTabActive.set(true);
  }

  private readonly _visitors = signal<readonly VisitorUser[]>([]);
  private readonly _visitorsCursor = signal(0);
  private readonly _visitorsMore = signal(false);
  private readonly _visitorsLoading = signal(false);
  private readonly _visitorsError = signal<string | null>(null);
  private visitorsActivated = false;

  readonly visitors = this._visitors.asReadonly();
  readonly visitorsMore = this._visitorsMore.asReadonly();
  readonly visitorsLoading = this._visitorsLoading.asReadonly();
  readonly visitorsError = this._visitorsError.asReadonly();

  activateVisitorsTab(): void {
    if (this.visitorsActivated) return;
    this.visitorsActivated = true;
    this.fetchVisitors(true);
  }
  loadMoreVisitors(): void {
    if (this._visitorsLoading()) return;
    this.fetchVisitors(false);
  }
  private fetchVisitors(reset: boolean): void {
    this._visitorsLoading.set(true);
    this._visitorsError.set(null);
    const index = reset ? 0 : this._visitorsCursor();
    this.api.visitors(index)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this._visitors.update((acc) => (reset ? page.list : [...acc, ...page.list]));
          this._visitorsCursor.set(page.index ?? 0);
          this._visitorsMore.set(page.more);
          this._visitorsLoading.set(false);
        },
        error: () => {
          this._visitorsLoading.set(false);
          this._visitorsError.set('Failed to load visitors');
        },
      });
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
