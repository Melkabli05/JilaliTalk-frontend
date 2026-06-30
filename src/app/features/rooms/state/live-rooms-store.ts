import {
  Injectable,
  inject,
  signal,
  computed,
  linkedSignal,
  effect,
  DestroyRef,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RoomsApi } from '../data/rooms-api';
import { ChannelListItem, Category, ChannelListResponse, filterRooms } from '../data/rooms-model';
import { ROOM_CATEGORIES } from '../data/room-categories';

const PAGE_SIZE = 20;
const MAX_SEARCH_OFFSET = PAGE_SIZE * 10;
const SEARCH_DEBOUNCE_MS = 250;

interface LivePageSource {
  readonly langId: number;
  readonly offset: number;
  readonly items: readonly ChannelListItem[];
}

@Injectable()
export class LiveRoomsStore {
  private readonly api = inject(RoomsApi);

  private readonly _offset = signal(0);
  private readonly _selectedCategoryId = signal<number | null>(null);
  private readonly _selectedLanguageId = signal<number | null>(null);
  private readonly _searchQuery = signal('');
  private readonly _debouncedSearchQuery = signal('');
  private searchDebounceTimer: ReturnType<typeof setTimeout> | undefined;

  private readonly roomsPage = rxResource({
    params: () => ({
      offset: this._offset(),
      langId: this._selectedLanguageId() ?? 0,
    }),
    defaultValue: { items: [] as ChannelListItem[], audienceTotal: 0 } as ChannelListResponse,
    stream: ({ params }) =>
      this.api.listLiveRooms(params.langId, PAGE_SIZE, params.offset, 1),
  });

  private readonly _rooms = linkedSignal<LivePageSource, readonly ChannelListItem[]>({
    source: () => ({
      langId: this._selectedLanguageId() ?? 0,
      offset: this._offset(),
      items: this.roomsPage.value()?.items ?? [],
    }),
    computation: (source, previous) => {
      if (
        !previous ||
        previous.source.langId !== source.langId ||
        source.offset === 0
      ) {
        return source.items;
      }
      const existing = new Set(previous.value.map((r) => r.channel.cname));
      const newItems = source.items.filter((r) => !existing.has(r.channel.cname));
      return [...previous.value, ...newItems];
    },
  });

  readonly rooms = this._rooms.asReadonly();
  readonly selectedCategoryId = this._selectedCategoryId.asReadonly();
  readonly selectedLanguageId = this._selectedLanguageId.asReadonly();
  readonly searchQuery = this._searchQuery.asReadonly();

  readonly isLoading = computed(() => this.roomsPage.isLoading());
  readonly error = computed(() => this.roomsPage.error());
  readonly hasMore = computed(() => (this.roomsPage.value()?.items.length ?? 0) === PAGE_SIZE);
  readonly isEmpty = computed(
    () => this.roomsPage.status() === 'resolved' && this._rooms().length === 0,
  );

  readonly isAutoSearching = computed(
    () =>
      this._debouncedSearchQuery().trim().length > 0 &&
      this.filteredRooms().length === 0 &&
      this.hasMore() &&
      this._offset() < MAX_SEARCH_OFFSET,
  );

  readonly filteredRooms = computed(() =>
    filterRooms(this._rooms(), this._selectedCategoryId(), this._selectedLanguageId(), this._debouncedSearchQuery()),
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
    if (this.isLoading() || !this.hasMore()) return;
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
    this._searchQuery.set(query);
    clearTimeout(this.searchDebounceTimer);
    if (!query.trim()) {
      this._debouncedSearchQuery.set(query);
      return;
    }
    this.searchDebounceTimer = setTimeout(
      () => this._debouncedSearchQuery.set(query),
      SEARCH_DEBOUNCE_MS,
    );
  }

  refresh(): void {
    this._offset.set(0);
    this.roomsPage.reload();
    this.recommendedResource.reload();
  }

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.searchDebounceTimer));

    effect(() => {
      if (this.isAutoSearching() && !this.isLoading()) {
        this.loadMore();
      }
    });
  }
}
