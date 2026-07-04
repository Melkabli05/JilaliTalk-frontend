import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { catchError, of } from 'rxjs';
import { ProfileApi } from './profile-api';
import { ProfileBundleResponse } from '../models/profile.model';
import { AuthStore } from '@core/auth/auth.store';

/**
 * Prefetches the profile bundle in parallel with the lazy-loaded route chunk, so the
 * network request races the JS download instead of running serially after the component
 * mounts.
 *
 * <p>Doesn't block navigation. The Observable-returning `resolve` form starts the fetch
 * the moment navigation begins but does NOT gate route activation in modern Angular —
 * the component mounts immediately, and its own `rxResource` would also fire if it
 * weren't skipped. The store dedups: once the seed lands via this resolver,
 * `ProfileStore.seedBundle()` flips a signal that closes the resource's `params`
 * over `undefined`, suppressing the duplicate HTTP call.
 *
 * <p>Returns `null` (synchronously) when there's no logged-in user, so navigating to
 * /profile pre-auth still activates the route. Upstream errors are caught and
 * swallowed (returning `null`) for the same reason — a slow or failing BFF should
 * not block the user from getting to their own profile page; the page renders its
 * own error state via the store's `bundleError`/`bundleLoading` signals.
 */
export const profileBundleResolver: ResolveFn<ProfileBundleResponse | null> = () => {
  const api = inject(ProfileApi);
  const authStore = inject(AuthStore);
  const selfId = authStore.user()?.userId;
  if (selfId === undefined) {
    return null;
  }
  return api.bundle(selfId).pipe(catchError(() => of(null)));
};
