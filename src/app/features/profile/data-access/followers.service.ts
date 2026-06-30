import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ProfileApi } from './profile-api';
import { FollowerUser, FollowersPage } from '../models/profile.model';

@Injectable({ providedIn: 'root' })
export class FollowersService {
  private readonly api = inject(ProfileApi);

  private readonly _nextCursor = signal<string | null>(null);
  readonly nextCursor = this._nextCursor.asReadonly();

  private readonly _followers = signal<FollowerUser[] | null>(null);
  readonly followers = this._followers.asReadonly();

  private readonly _loading = signal(false);
  readonly loading = this._loading.asReadonly();

  async loadMore(): Promise<void> {
    if (this._loading()) return;
    const cursor = this._nextCursor() ?? '';
    this._loading.set(true);
    try {
      const page: FollowersPage = await firstValueFrom(this.api.fetchFollowers(cursor));
      if (page.data?.list) {
        const existing = this._followers() ?? [];
        this._followers.set([...existing, ...page.data.list]);
        this._nextCursor.set(page.data.more ? page.data.pageIndex : null);
      } else {
        this._followers.set([]);
        this._nextCursor.set(null);
      }
    } finally {
      this._loading.set(false);
    }
  }

  reset(): void {
    this._followers.set(null);
    this._nextCursor.set(null);
  }

  toggleMutual(userId: number): void {
    this._followers.update(list =>
      list?.map(u => u.userId === userId ? { ...u, isMutual: !u.isMutual } : u) ?? null,
    );
  }
}
