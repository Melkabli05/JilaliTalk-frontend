import { Service, inject, signal, computed, DestroyRef } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map, of } from 'rxjs';
import { ProfileApi } from '../data-access/profile-api';
import { PaginatedList } from '../data-access/paginated-list';
import { AuthStore } from '@core/auth/auth.store';
import { ToastService } from '@core/services/toast.service';
import {
  ProfileBundleResponse,
  SocialListPage,
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
  private readonly toast = inject(ToastService);
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
  /** Server-side ban on mutating profile fields. Same field as Android's
   *  {@code LiveWSSRoomUser}/com.hellotalk.feature.common.model.f isModifyRestricted —
   *  see {@code endpots/organized_captures_new/profile_v2_limitations.jsonl} for the wire shape
   *  (snake_case on the wire, camelCase in Java/TS via Gson's default naming policy).
   *  Reading this from a trusted BFF proxy (not from the raw upstream) is the whole point — the
   *  upstream response is unsigned and could be MITM'd. */
  readonly isModifyRestricted = computed(() => this.bundle()?.limitations?.isModifyRestricted ?? false);

  /** One-shot toast + return so mutating action buttons can call this before issuing the
   *  request and bail early when the flag is set. The action still issues the request so the
   *  server-side guard (which we should also add — see jilalibff ProfileEditClient) gets the
   *  call and can return its own error. */
  guardProfileEdit(): boolean {
    if (this.isModifyRestricted()) {
      this.toast.warning('Profile editing is restricted on this account.');
      return false;
    }
    return true;
  }

  reloadBundle(): void {
    this._bundle.set(null);
    this.bundleRef.reload();
  }

  /** Cursor-paginated with a "Load more" button — see `PaginatedList`'s doc for why that
   *  needs its own accumulator instead of the `rxResource` used for every single-page list
   *  in this store. The `map` adapts each API's own page shape (`pageIndex`/`index` field
   *  names differ) to `PaginatedList`'s generic `{ list, nextCursor, more }` contract. */
  private readonly followersList = new PaginatedList(
    '',
    (cursor: string) =>
      this.api.followers(cursor, FOLLOWERS_PAGE_SIZE).pipe(
        map((page) => ({ list: page.list, nextCursor: page.pageIndex ?? '', more: page.more })),
      ),
    'Failed to load followers',
    this.destroyRef,
  );
  readonly followers = this.followersList.items;
  readonly followersMore = this.followersList.more;
  readonly followersLoading = this.followersList.loading;
  readonly followersError = this.followersList.error;
  activateFollowersTab(): void {
    this.followersList.activate();
  }
  loadMoreFollowers(): void {
    this.followersList.loadMore();
  }

  private readonly _followingTabActive = signal(false);
  private readonly followingRef = rxResource<SocialListPage, true | undefined>({
    params: () => (this._followingTabActive() ? true : undefined),
    stream: ({ params }) =>
      params === undefined ? of(EMPTY_SOCIAL_PAGE) : this.api.following(FOLLOWERS_PAGE_SIZE),
    defaultValue: EMPTY_SOCIAL_PAGE,
  });
  /** No "load more" for following — `ProfileApi.following` doesn't accept a cursor, so this
   *  tab only ever shows the first page (matches what the API actually supports). */
  readonly following = computed(() => this.followingRef.value().list);
  readonly followingLoading = this.followingRef.isLoading;
  readonly followingError = computed(() => (this.followingRef.error() ? 'Failed to load following' : null));
  activateFollowingTab(): void {
    this._followingTabActive.set(true);
  }

  private readonly visitorsList = new PaginatedList(
    0,
    (cursor: number) =>
      this.api.visitors(cursor).pipe(
        map((page) => ({ list: page.list, nextCursor: page.index ?? 0, more: page.more })),
      ),
    'Failed to load visitors',
    this.destroyRef,
  );
  readonly visitors = this.visitorsList.items;
  readonly visitorsMore = this.visitorsList.more;
  readonly visitorsLoading = this.visitorsList.loading;
  readonly visitorsError = this.visitorsList.error;
  activateVisitorsTab(): void {
    this.visitorsList.activate();
  }
  loadMoreVisitors(): void {
    this.visitorsList.loadMore();
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
