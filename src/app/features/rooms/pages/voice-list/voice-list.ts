import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  viewChild,
  ElementRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { RoomsStore } from '../../state/rooms-store';
import { ChannelListItem } from '../../data/rooms-model';
import { joinRoom as joinRoomCommand } from '../../data/join-room.util';
import { CategoryFilterComponent } from '../../ui/category-filter/category-filter';
import { LanguageFilterComponent } from '../../ui/language-filter/language-filter';
import { SearchBarComponent } from '../../ui/search-bar/search-bar';
import { RoomCardComponent } from '../../ui/room-card/room-card';
import { RoomSkeletonComponent } from '../../ui/room-skeleton/room-skeleton';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { CountryFlagComponent } from '@shared/ui/host-flag/country-flag';
import { LanguageTagComponent } from '@shared/ui/host-flag/language-tag';
import { InfiniteScrollDirective } from '@shared/directives/infinite-scroll.directive';
import {
  LucideLayoutGrid,
  LucideList,
  LucideFlame,
  LucideTrendingUp,
  LucideEye,
  LucideEyeOff,
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
    CountryFlagComponent,
    LanguageFilterComponent,
    LanguageTagComponent,
    SearchBarComponent,
    RoomCardComponent,
    RoomSkeletonComponent,
    AvatarComponent,
    ButtonComponent,
    InfiniteScrollDirective,
    LucideLayoutGrid,
    LucideList,
    LucideFlame,
    LucideTrendingUp,
    LucideEye,
    LucideEyeOff,
    LucideRefreshCw,
    LucideSearch,
    LucideChevronLeft,
    LucideChevronRight,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [RoomsStore],
  templateUrl: './voice-list.html',
  styleUrls: ['./voice-list.scss'],
})
export class VoiceListComponent {
  private readonly store = inject(RoomsStore);
  private readonly router = inject(Router);

  private readonly carousel = viewChild<ElementRef<HTMLElement>>('carouselScroll');

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

  scrollCarousel(direction: 'prev' | 'next'): void {
    const el = this.carousel()?.nativeElement;
    if (!el) return;
    const amount = 264;
    el.scrollBy({ left: direction === 'next' ? amount : -amount, behavior: 'smooth' });
  }
}
