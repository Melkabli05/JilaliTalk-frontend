import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { Router } from '@angular/router';
import { LiveRoomsStore } from '../../state/live-rooms.store';
import { ChannelListItem } from '../../data/rooms-model';
import { joinRoom as joinRoomCommand } from '../../data/join-room.util';
import { LanguageFilterComponent } from '../../ui/language-filter/language-filter';
import { LiveRoomCardComponent } from '../../ui/live-room-card/live-room-card';
import { InfiniteScrollDirective } from '@shared/directives/infinite-scroll.directive';
import { SearchBarComponent } from '@shared/ui/search-bar/search-bar';
import { CardSkeletonComponent } from '@shared/ui/card-skeleton/card-skeleton';
import {
  LucideLayoutGrid,
  LucideList,
  LucideFlame,
  LucideRefreshCw,
  LucideSearch,
} from '@lucide/angular';

type ViewMode = 'grid' | 'list';

@Component({
  selector: 'app-live-list',
  imports: [
    LanguageFilterComponent,
    SearchBarComponent,
    LiveRoomCardComponent,
    CardSkeletonComponent,
    InfiniteScrollDirective,
    LucideLayoutGrid,
    LucideList,
    LucideFlame,
    LucideRefreshCw,
    LucideSearch,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './live-list.html',
  styleUrls: ['./live-list.scss'],
})
export class LiveList {
  private readonly store = inject(LiveRoomsStore);
  private readonly router = inject(Router);

  readonly filteredRooms = this.store.filteredRooms;
  readonly recommendedRooms = this.store.recommendedRooms;
  readonly isLoadingRecommended = this.store.isLoadingRecommended;
  readonly isLoading = this.store.isLoading;
  readonly hasMore = this.store.hasMore;
  readonly selectedLanguageId = this.store.selectedLanguageId;
  readonly searchQuery = this.store.searchQuery;
  readonly error = this.store.error;

  readonly viewMode = signal<ViewMode>('grid');
  readonly skeletonItems = computed(() => Array(6).fill(0));
  readonly recommendedSkeletons = computed(() => Array(4).fill(0));

  readonly hasActiveFilters = computed(
    () =>
      this.selectedLanguageId() !== null ||
      this.searchQuery().length > 0,
  );
  readonly activeFilterCount = computed(() => {
    let count = 0;
    if (this.selectedLanguageId() !== null) count++;
    if (this.searchQuery().length > 0) count++;
    return count;
  });

  setViewMode(mode: ViewMode): void {
    this.viewMode.set(mode);
  }
  onLanguageChange(id: number | null): void {
    this.store.selectLanguage(id);
  }
  onSearchChange(q: string): void {
    this.store.setSearchQuery(q);
  }
  refresh(): void {
    this.store.refresh();
  }
  loadMore(): void {
    this.store.loadMore();
  }
  clearFilters(): void {
    this.store.selectLanguage(null);
    this.store.setSearchQuery('');
  }
  resetFilters(): void {
    this.clearFilters();
  }

  async joinRoom(room: ChannelListItem, visible: boolean, event?: Event): Promise<void> {
    await joinRoomCommand(this.router, room, visible, event);
  }

  onJoinRoom(payload: { room: ChannelListItem; visible: boolean }): void {
    void this.joinRoom(payload.room, payload.visible);
  }
}