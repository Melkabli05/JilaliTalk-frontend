import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ProfileApi } from './profile-api';
import { VisitorUser, VisitorsPage } from '../models/profile.model';

@Injectable({ providedIn: 'root' })
export class VisitorsService {
  private readonly api = inject(ProfileApi);

  private readonly _nextCursor = signal<number | null>(null);
  readonly nextCursor = this._nextCursor.asReadonly();

  private readonly _visitors = signal<VisitorUser[] | null>(null);
  readonly visitors = this._visitors.asReadonly();

  private readonly _loading = signal(false);
  readonly loading = this._loading.asReadonly();

  async loadMore(): Promise<void> {
    if (this._loading()) return;
    const cursor = this._nextCursor() ?? 0;
    this._loading.set(true);
    try {
      const page: VisitorsPage = await firstValueFrom(
        this.api.fetchVisitors({ index: cursor }),
      );
      if (page.data?.list) {
        const existing = this._visitors() ?? [];
        this._visitors.set([...existing, ...page.data.list]);
        this._nextCursor.set(page.data.more ? page.data.index : null);
      } else {
        this._visitors.set([]);
        this._nextCursor.set(null);
      }
    } finally {
      this._loading.set(false);
    }
  }

  reset(): void {
    this._visitors.set(null);
    this._nextCursor.set(null);
  }
}