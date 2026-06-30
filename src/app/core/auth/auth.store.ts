import { Injectable, signal, computed } from '@angular/core';

export interface AuthUser {
  readonly userId: number;
  readonly nickname: string;
  readonly email: string;
  readonly headUrl: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly _user = signal<AuthUser | null>(null);

  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);

  login(user: AuthUser): void {
    this._user.set(user);
  }

  logout(): void {
    this._user.set(null);
  }
}