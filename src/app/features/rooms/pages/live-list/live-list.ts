import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { Router } from '@angular/router';
import { LiveRoomsStore } from '../../state/live-rooms-store';
import { RoomsApi } from '../../data/rooms-api';
import { ChannelListItem } from '../../data/rooms-model';
import { LanguageFilterComponent } from '../../ui/language-filter/language-filter';
import { SearchBarComponent } from '../../ui/search-bar/search-bar';
import { LiveRoomCardComponent } from '../../ui/live-room-card/live-room-card';
import { RoomSkeletonComponent } from '../../ui/room-skeleton/room-skeleton';
import { InfiniteScrollDirective } from '@shared/directives/infinite-scroll.directive';
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
    RoomSkeletonComponent,
    InfiniteScrollDirective,
    LucideLayoutGrid,
    LucideList,
    LucideFlame,
    LucideRefreshCw,
    LucideSearch,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [RoomsApi, LiveRoomsStore],
  templateUrl: './live-list.html',
  styleUrls: ['../voice-list/voice-list.scss'],
})
export class LiveList {
  private readonly store = inject(LiveRoomsStore);
  private readonly router = inject(Router);

  readonly filteredRooms = this.store.filteredRooms;
  readonly recommendedRooms = this.store.recommendedRooms;
  readonly isLoadingRecommended = this.store.isLoadingRecommended;
  readonly isLoading = this.store.isLoading;
  readonly hasMore = this.store.hasMore;
  readonly isAutoSearching = this.store.isAutoSearching;
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
    event?.stopPropagation();
    if (event?.type === 'keydown') event.preventDefault();

    const cname = room.channel.cname;
    const busiType = room.channel.busiType;

    try {
      // Video rooms (busiType=1) use the /room/video/:cname/:busiType route;
      // voice rooms (busiType=2) use /room/:cname/:busiType.
      // Invisible entry is carried as a query param.
      const path = busiType === 1 ? '/room/video' : '/room';
      const queryParams = visible ? {} : { visible: 'false' };
      await this.router.navigate([path, cname, busiType], { queryParams });
    } catch (err) {
      console.error('Failed to join room', err);
    }
  }

  onJoinRoom(payload: { room: ChannelListItem; visible: boolean }): void {
    void this.joinRoom(payload.room, payload.visible);
  }
}