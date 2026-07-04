import {
  Injectable,
  inject,
  signal,
  computed,
  linkedSignal,
  DestroyRef,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RoomsApi } from '../data/rooms-api';
import { ChannelListItem, Category, ChannelListResponse, RoomType, filterRooms } from '../data/rooms-model';
import { ROOM_CATEGORIES } from '../data/room-categories';
import { SearchDebounce, paginateDedup } from '../data/pagination-search.util';

const PAGE_SIZE = 20;
const MAX_SEARCH_PAGES = 5; // 5 × 20 = 100 rooms, same ceiling as the old MAX_SEARCH_OFFSET

interface LivePageSource {
  readonly langId: number;
  readonly offset: number;
  readonly items: readonly ChannelListItem[];
}

@Injectable()
export class LiveRoomsStore {
  private readonly api = inject(RoomsApi);
  private readonly search = new SearchDebounce(inject(DestroyRef));

  private readonly _offset = signal(0);
  private readonly _selectedCategoryId = signal<number | null>(null);
  private readonly _selectedLanguageId = signal<number | null>(null);

  private readonly roomsPage = rxResource({
    params: () => ({
      offset: this._offset(),
      langId: this._selectedLanguageId() ?? 0,
      query: this.search.debounced(),
    }),
    defaultValue: { items: [] as ChannelListItem[], audienceTotal: 0 } as ChannelListResponse,
    stream: ({ params }) =>
      params.query.trim()
        ? this.api.searchRooms(RoomType.Live, params.query, params.langId, MAX_SEARCH_PAGES)
        : this.api.listLiveRooms(params.langId, PAGE_SIZE, params.offset, 1),
  });

  private readonly _rooms = linkedSignal<LivePageSource, readonly ChannelListItem[]>({
    source: () => ({
      langId: this._selectedLanguageId() ?? 0,
      offset: this._offset(),
      items: this.roomsPage.value()?.items ?? [],
    }),
    computation: (source, previous) =>
      paginateDedup(
        source,
        previous,
        (a, b) => a.langId === b.langId,
        (r) => r.channel.cname,
      ),
  });

  readonly rooms = this._rooms.asReadonly();
  readonly selectedCategoryId = this._selectedCategoryId.asReadonly();
  readonly selectedLanguageId = this._selectedLanguageId.asReadonly();
  readonly searchQuery = this.search.query;

  readonly isLoading = computed(() => this.roomsPage.isLoading());
  readonly error = computed(() => this.roomsPage.error());
  readonly hasMore = computed(() =>
    this.search.debounced().trim()
      ? false
      : (this.roomsPage.value()?.items.length ?? 0) === PAGE_SIZE,
  );
  readonly isEmpty = computed(
    () => this.roomsPage.status() === 'resolved' && this._rooms().length === 0,
  );

  readonly filteredRooms = computed(() =>
    filterRooms(this._rooms(), this._selectedCategoryId(), this._selectedLanguageId(), this.search.debounced()),
  );

  private readonly recommendedResource = rxResource({
    defaultValue: { items: [] as ChannelListItem[], audienceTotal: 0 } as ChannelListResponse,
    stream: () => this.api.recommendLiveRooms('moment_tab'),
  });
  readonly recommendedRooms = computed<readonly ChannelListItem[]>(
    () => this.recommendedResource.value()?.items ?? [],
  );
  readonly isLoadingRecommended = computed(() => this.recommendedResource.isLoading());
  readonly recommendedError = computed(() => this.recommendedResource.error());

  readonly categories = computed<readonly Category[]>(() => ROOM_CATEGORIES);

  loadMore(): void {
    if (this.isLoading() || !this.hasMore() || this.search.debounced().trim()) return;
    this._offset.update((o) => o + PAGE_SIZE);
  }

  selectCategory(categoryId: number | null): void {
    this._selectedCategoryId.set(categoryId);
  }

  selectLanguage(langId: number | null): void {
    this._offset.set(0);
    this._selectedLanguageId.set(langId);
  }

  setSearchQuery(query: string): void {
    this._offset.set(0);
    this.search.set(query);
  }

  refresh(): void {
    this._offset.set(0);
    this.roomsPage.reload();
    this.recommendedResource.reload();
  }
}
