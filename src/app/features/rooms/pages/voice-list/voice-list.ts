import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  viewChild,
  ElementRef,
  DestroyRef,
  afterNextRender,
} from '@angular/core';
import { Router } from '@angular/router';
import { VoiceRoomsStore } from '../../state/voice-rooms.store';
import { ChannelListItem } from '../../data/rooms-model';
import { joinRoom as joinRoomCommand } from '../../data/join-room.util';
import { CategoryFilterComponent } from '../../ui/category-filter/category-filter';
import { LanguageFilterComponent } from '../../ui/language-filter/language-filter';
import { RoomCardComponent } from '../../ui/room-card/room-card';
import { RecommendedRoomCardComponent } from '../../ui/recommended-room-card/recommended-room-card';
import { RoomSharePickerComponent } from '../../ui/room-share-picker/room-share-picker';
import { SearchBarComponent } from '@shared/ui/search-bar/search-bar';
import { CardSkeletonComponent } from '@shared/ui/card-skeleton/card-skeleton';
import { EmptyStateComponent } from '@shared/ui/empty-state/empty-state.component';
import { InfiniteScrollDirective } from '@shared/directives/infinite-scroll.directive';
import {
  LucideLayoutGrid,
  LucideList,
  LucideFlame,
  LucideRefreshCw,
  LucideSearch,
  LucideChevronLeft,
  LucideChevronRight,
} from '@lucide/angular';

type ViewMode = 'grid' | 'list';

@Component({
  selector: 'app-voice-list',
  imports: [
    CategoryFilterComponent,
    LanguageFilterComponent,
    SearchBarComponent,
    RoomCardComponent,
    RecommendedRoomCardComponent,
    RoomSharePickerComponent,
    CardSkeletonComponent,
    EmptyStateComponent,
    InfiniteScrollDirective,
    LucideLayoutGrid,
    LucideList,
    LucideFlame,
    LucideRefreshCw,
    LucideSearch,
    LucideChevronLeft,
    LucideChevronRight,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './voice-list.html',
  styleUrls: ['./voice-list.scss'],
})
export class VoiceListComponent {
  private readonly store = inject(VoiceRoomsStore);
  private readonly router = inject(Router);

  private readonly carousel = viewChild<ElementRef<HTMLElement>>('carouselScroll');

  constructor() {
    afterNextRender(() => this.store.restoreScrollPosition());
    inject(DestroyRef).onDestroy(() => this.store.saveScrollPosition());
  }

  readonly filteredRooms = this.store.filteredRooms;
  readonly recommendedRooms = this.store.recommendedRooms;
  readonly isLoadingRecommended = this.store.isLoadingRecommended;
  readonly categories = this.store.categories;
  readonly isLoading = this.store.isLoading;
  readonly hasMore = this.store.hasMore;
  readonly selectedCategoryId = this.store.selectedCategoryId;
  readonly selectedLanguageId = this.store.selectedLanguageId;
  readonly searchQuery = this.store.searchQuery;
  readonly error = this.store.error;

  readonly sharingRoom = signal<ChannelListItem | null>(null);

  readonly viewMode = signal<ViewMode>('grid');
  readonly skeletonItems = computed(() => Array(6).fill(0));
  readonly recommendedSkeletons = computed(() => Array(4).fill(0));

  readonly hasActiveFilters = computed(
    () =>
      this.selectedCategoryId() !== null ||
      this.selectedLanguageId() !== null ||
      this.searchQuery().length > 0,
  );
  readonly activeFilterCount = computed(() => {
    let count = 0;
    if (this.selectedCategoryId() !== null) count++;
    if (this.selectedLanguageId() !== null) count++;
    if (this.searchQuery().length > 0) count++;
    return count;
  });

  setViewMode(mode: ViewMode): void {
    this.viewMode.set(mode);
  }
  onCategoryChange(id: number | null): void {
    this.store.selectCategory(id);
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
    this.store.selectCategory(null);
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

  onRecommendedJoin(payload: { room: ChannelListItem; visible: boolean }): void {
    void this.joinRoom(payload.room, payload.visible);
  }

  onShareRoom(room: ChannelListItem): void {
    this.sharingRoom.set(room);
  }

  scrollCarousel(direction: 'prev' | 'next'): void {
    const el = this.carousel()?.nativeElement;
    if (!el) return;
    const amount = 264;
    el.scrollBy({ left: direction === 'next' ? amount : -amount, behavior: 'smooth' });
  }
}
