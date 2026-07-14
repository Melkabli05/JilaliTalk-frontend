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
export const AUTH_USER_STORAGE_KEY = 'jilali_auth_user';

@Service()
export class AuthStore {
  private readonly storage = inject(StorageService);
  private readonly _user = signal<AuthUser | null>(this.storage.get<AuthUser>(AUTH_USER_STORAGE_KEY));

  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);

  login(user: AuthUser): void {
    this._user.set(user);
    this.persistUser(user);
  }

  logout(): void {
    this._user.set(null);
    this.storage.remove(AUTH_USER_STORAGE_KEY);
    this.storage.remove(IM_CREDENTIALS_STORAGE_KEY);
  }

  updateImJwt(jwt: string): void {
    const current = this._user();
    if (!current) return;
    const updated: AuthUser = { ...current, imJwt: jwt };
    this._user.set(updated);
    this.persistUser(updated);
  }

  getImCredentials(): ImCredentials | null {
    const user = this._user();
    if (user?.imJwt && user.imDeviceId && user.imDeviceModel) {
      return { jwt: user.imJwt, deviceId: user.imDeviceId, deviceModel: user.imDeviceModel };
    }
    return this.storage.get<ImCredentials>(IM_CREDENTIALS_STORAGE_KEY);
  }

  private persistUser(user: AuthUser): void {
    this.storage.set(AUTH_USER_STORAGE_KEY, user satisfies AuthUser);
    this.persistImCredentials(user);
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
