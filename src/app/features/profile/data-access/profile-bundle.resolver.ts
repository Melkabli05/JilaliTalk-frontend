import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { ProfileApi } from './profile-api';
import { ProfileBundleResponse } from '../models/profile.model';
import { AuthStore } from '@core/auth/auth.store';

/**
 * Prefetches the profile bundle in parallel with the lazy-loaded route chunk, so the
 * network request races the JS download instead of running serially after the component
 * mounts.
 *
 * <p>Returns an `Observable<ProfileBundleResponse | null>` (null when there's no
 * logged-in user — guards against navigating to /profile pre-auth, where the resolver
 * must resolve cleanly so the route activates with `bundle = null` and the page
 * renders its own empty/error state via the existing {@link ProfileStore} bundle
 * `rxResource`).
 *
 * <p>Doesn't block the user on a slow upstream — the resolver's observable is fired
 * the moment navigation begins, but the router still activates the route immediately
 * (resolvers only block navigation when used via `canActivate` with a promise-returning
 * function; an `Observable`-returning `resolve` function starts the work but does NOT
 * gate route activation in modern Angular). The component mounts and its own
 * `rxResource` fires — whichever fetch lands first wins, and the resolver fetch will
 * typically land first (or simultaneously) with the cold-BFF case. The `rxResource`'s
 * result is what the page renders, so a duplicate in-flight request is harmless; the
 * BFF's own 24h Caffeine cache (`@Cacheable("user-info")`) ensures both calls hit
 * the same upstream response.
 *
 * <p>Deliberately doesn't write to `UserInfoService`'s cache — that cache is a
 * session-scoped read-through store, not a request-coordination mechanism, and the
 * existing `fetchUserInfo` doc explicitly says it never skips the BFF (so the page
 * component would fetch again regardless). The win here is parallelism, not dedup.
 */
export const profileBundleResolver: ResolveFn<ProfileBundleResponse | null> = () => {
  const api = inject(ProfileApi);
  const authStore = inject(AuthStore);
  const selfId = authStore.user()?.userId;
  if (selfId === undefined) {
    return null;
  }
  return api.bundle(selfId);
};
