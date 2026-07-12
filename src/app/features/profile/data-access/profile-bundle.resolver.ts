import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { catchError, of } from 'rxjs';
import { ProfileApi } from './profile-api';
import { ProfileBundleResponse } from '../models/profile.model';
import { AuthStore } from '@core/auth/auth.store';

/**
 * Angular resolves `resolve` guards and a route's lazy `loadComponent` chunk concurrently, not
 * sequentially — so returning the bundle fetch here (rather than letting `ProfileStore` kick
 * it off after the component loads) means the network round-trip overlaps the JS chunk
 * download instead of starting after it. On the common warm-navigation path both are done by
 * the time the route activates, so the profile page renders fully populated with no visible
 * loading skeleton, instead of "chunk downloads, then a skeleton flashes while data loads."
 *
 * Never lets a failure block navigation: `selfId === undefined` (auth not yet restored) and
 * a failed HTTP call both resolve to `null` rather than rejecting, and `ProfileStore`'s own
 * `bundleRef` rxResource is the fallback — if this resolver comes back empty for any reason,
 * the store fetches client-side instead, so the page still ends up populated either way.
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
