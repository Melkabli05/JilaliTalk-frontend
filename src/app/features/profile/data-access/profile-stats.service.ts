import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ProfileApi } from './profile-api';
import { ProfileStats } from '../models/profile.model';

@Injectable({ providedIn: 'root' })
export class ProfileStatsService {
  private readonly api = inject(ProfileApi);

  private readonly _stats = signal<ProfileStats['data'] | null>(null);
  readonly stats = this._stats.asReadonly();

  private readonly _loading = signal(false);
  readonly loading = this._loading.asReadonly();

  async load(): Promise<void> {
    this._loading.set(true);
    try {
      const response: ProfileStats = await firstValueFrom(this.api.fetchStats());
      this._stats.set(response.data);
    } finally {
      this._loading.set(false);
    }
  }

  /** Seed stats from an external caller (e.g. ProfileStore parallel fetch). */
  setStats(data: ProfileStats['data'] | null): void {
    this._stats.set(data);
  }

  reset(): void {
    this._stats.set(null);
  }
}