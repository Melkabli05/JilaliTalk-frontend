import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { catchError, of } from 'rxjs';
import { ProfileApi } from './profile-api';
import { ProfileBundleResponse } from '../models/profile.model';
import { AuthStore } from '@core/auth/auth.store';

export const profileBundleResolver: ResolveFn<ProfileBundleResponse | null> = () => {
  const api = inject(ProfileApi);
  const authStore = inject(AuthStore);
  const selfId = authStore.user()?.userId;

  if (selfId === undefined) {
    return null;
  }
  return api.bundle(selfId).pipe(catchError(() => of(null)));
};
