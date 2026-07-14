import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AUTH_USER_STORAGE_KEY, AuthStore } from '@core/auth/auth.store';
import { StorageService } from '@core/services/storage.service';

export const authGuard: CanActivateFn = (_route, state): boolean | UrlTree => {
  const authStore = inject(AuthStore);
  const storage = inject(StorageService);
  const router = inject(Router);

  if (authStore.isAuthenticated() || storage.get(AUTH_USER_STORAGE_KEY) !== null) {
    return true;
  }

  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};