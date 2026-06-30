import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ProfileApi } from './profile-api';
import { FollowerUser, FollowingPage } from '../models/profile.model';

@Injectable({ providedIn: 'root' })
export class FollowingService {
  private readonly api = inject(ProfileApi);

  private readonly _nextCursor = signal<string | null>(null);
  readonly nextCursor = this._nextCursor.asReadonly();

  private readonly _following = signal<FollowerUser[] | null>(null);
  readonly following = this._following.asReadonly();

  private readonly _totalCount = signal<number>(0);
  readonly totalCount = this._totalCount.asReadonly();

  private readonly _loading = signal(false);
  readonly loading = this._loading.asReadonly();

  private readonly _search = signal('');
  readonly search = this._search.asReadonly();

  async loadMore(search = ''): Promise<void> {
    if (this._loading() && search === this._search()) return;
    const cursor = search !== this._search() ? '' : (this._nextCursor() ?? '');
    const prevSearch = this._search();
    this._loading.set(true);
    try {
      const page: FollowingPage = await firstValueFrom(
        this.api.fetchFollowing(cursor, 20, search),
      );
      if (page.data?.list) {
        const existing = search === prevSearch ? (this._following() ?? []) : [];
        const newList = [...existing, ...page.data.list];
        this._following.set(newList);
        this._nextCursor.set(page.data.more ? page.data.pageIndex : null);
        this._totalCount.set(page.data.count);
      } else {
        this._following.set([]);
        this._nextCursor.set(null);
        this._totalCount.set(0);
      }
    } finally {
      this._loading.set(false);
      this._search.set(search);
    }
  }

  reset(): void {
    this._following.set(null);
    this._nextCursor.set(null);
    this._totalCount.set(0);
    this._search.set('');
  }

  toggleMutual(userId: number): void {
    this._following.update(list =>
      list?.map(u => u.userId === userId ? { ...u, isMutual: !u.isMutual } : u) ?? null,
    );
  }
}
