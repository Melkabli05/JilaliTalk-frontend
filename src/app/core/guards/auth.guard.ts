import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthStore } from '@core/auth/auth.store';

/**
 * Redirects unauthenticated visitors to {@code /login?returnUrl=<attempted-path>}.
 *
 * Picking a dedicated login route over the existing {@code /error/401} full-page error surface:
 *   1. The error page documents itself as "Session expired — reload the page to reconnect," which
 *      is correct for a real session-expiry scenario but wrong for the much more common
 *      "never logged in" case where reloading doesn't help.
 *   2. Stamping the attempted URL into a returnUrl param lets the LoginPageComponent bring the
 *      user back to where they were trying to go after a successful login — the only UX that
 *      doesn't bounce them from /messages to / and lose their original intent.
 *
 * Same-origin validation on the returnUrl is enforced inside LoginPageComponent (it rejects
 * absolute URLs and protocol-relative paths); the guard just passes the raw attempt through,
 * which is fine since the page is the only thing that consumes it.
 */
export const authGuard: CanActivateFn = (route, state): boolean | UrlTree => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};