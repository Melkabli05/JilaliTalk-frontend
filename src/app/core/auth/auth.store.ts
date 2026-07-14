import { signal, computed, inject, Service } from '@angular/core';
import { StorageService } from '@core/services/storage.service';

export interface AuthUser {
  readonly userId: number;
  readonly nickname: string;
  readonly email: string;
  readonly headUrl: string | null;
  readonly imJwt?: string;
  readonly imDeviceId?: string;
  readonly imDeviceModel?: string;
}

export interface ImCredentials {
  readonly jwt: string;
  readonly deviceId: string;
  readonly deviceModel: string;
}

export const IM_CREDENTIALS_STORAGE_KEY = 'jilali_im_credentials';

@Service()
export class AuthStore {
  private readonly storage = inject(StorageService);
  private readonly _user = signal<AuthUser | null>(null);

  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);

  login(user: AuthUser): void {
    this._user.set(user);
    this.persistImCredentials(user);
  }

  logout(): void {
    this._user.set(null);
  }

  /** Patches the in-memory + persisted IM credentials without touching the rest of the
   *  profile — used when the messaging server rotates the JWT on login (see the reference
   *  client's `onSessionReady` `newJwt`), so this browser's next reconnect uses the fresh
   *  token instead of the one originally issued by `/auth/me`. */
  updateImJwt(jwt: string): void {
    const current = this._user();
    if (!current) return;
    const updated: AuthUser = { ...current, imJwt: jwt };
    this._user.set(updated);
    this.persistImCredentials(updated);
  }

  /** Reads IM credentials from the current user signal, falling back to the last-persisted
   *  copy in localStorage (e.g. if the in-memory signal was reset by a logout/login cycle
   *  that didn't carry them, but a prior session did). */
  getImCredentials(): ImCredentials | null {
    const user = this._user();
    if (user?.imJwt && user.imDeviceId && user.imDeviceModel) {
      return { jwt: user.imJwt, deviceId: user.imDeviceId, deviceModel: user.imDeviceModel };
    }
    return this.storage.get<ImCredentials>(IM_CREDENTIALS_STORAGE_KEY);
  }

  private persistImCredentials(user: AuthUser): void {
    if (user.imJwt && user.imDeviceId && user.imDeviceModel) {
      this.storage.set(IM_CREDENTIALS_STORAGE_KEY, {
        jwt: user.imJwt,
        deviceId: user.imDeviceId,
        deviceModel: user.imDeviceModel,
      } satisfies ImCredentials);
    }
  }
}
