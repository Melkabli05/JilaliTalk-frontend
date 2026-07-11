import {
  Service,
  inject,
  signal,
  computed,
  linkedSignal,
  effect,
  DestroyRef,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { RoomsApi } from '../data/rooms-api';
import { ChannelListItem, Category, ChannelListResponse, RoomType } from '../data/rooms-model';
import { filterRooms } from '../data/room-filter.util';
import { SearchDebounce, paginateDedup } from '../data/pagination-search.util';
import { RoomsPreferencesStore } from '@store/rooms-preferences.store';

const PAGE_SIZE = 20;
const MAX_SEARCH_PAGES = 5; // 5 × 20 = 100 rooms, same ceiling as the old MAX_SEARCH_OFFSET

interface RoomsPageSource {
  readonly type: RoomType;
  readonly langId: number | null;
  readonly offset: number;
  readonly items: readonly ChannelListItem[];
}

@Service()
export abstract class RoomListStore {
  protected readonly api = inject(RoomsApi);
  protected readonly prefs = inject(RoomsPreferencesStore);
  /** Page-scoped debounce on top of the persisted prefs query — the prefs
   *  store updates synchronously on every keystroke (for cross-page persistence
   *  and for the `<app-search-bar>` input echo), but the network request only
   *  fires once the user stops typing for 250ms. */
  protected readonly search = new SearchDebounce(inject(DestroyRef));

  private readonly _currentType = signal<RoomType>(RoomType.Voice);
  protected readonly _offset = signal(0);

  protected readonly roomsPage = rxResource({
    params: () => ({
      type: this._currentType(),
      offset: this._offset(),
      langId: this.prefs.languageId() ?? 0,
      query: this.search.debounced(),
    }),
    defaultValue: { items: [] as ChannelListItem[], audienceTotal: 0 } as ChannelListResponse,
    stream: ({ params }) =>
      params.query.trim()
        ? this.searchRooms(params.query, params.langId, MAX_SEARCH_PAGES)
        : this.listRooms(params.type, params.langId, PAGE_SIZE, params.offset, 1),
  });

  protected readonly _rooms = linkedSignal<RoomsPageSource, readonly ChannelListItem[]>({
    source: () => ({
      type: this._currentType(),
      langId: this.prefs.languageId(),
      offset: this._offset(),
      items: this.roomsPage.value()?.items ?? [],
    }),
    computation: (source, previous) =>
      paginateDedup(
        source,
        previous,
        (a, b) => a.type === b.type && a.langId === b.langId,
        (r) => r.channel.cname,
      ),
  });

  readonly rooms = this._rooms.asReadonly();
  readonly currentType = this._currentType.asReadonly();
  readonly selectedCategoryId = this.prefs.categoryId;
  readonly selectedLanguageId = this.prefs.languageId;
  readonly searchQuery = this.prefs.searchQuery;

  constructor() {
    // Re-feed the prefs query through the page-scoped debouncer so the
    // rxResource only re-fetches once the user stops typing for 250ms. The
    // raw `searchQuery` signal above stays in sync instantly so the input
    // echo doesn't lag behind the persisted value.
    effect(() => this.search.set(this.prefs.searchQuery()));
  }

  readonly isLoading = computed(() => this.roomsPage.isLoading());
  readonly error = computed(() => this.roomsPage.error());
  readonly hasMore = computed(() =>
    this.prefs.searchQuery().trim()
      ? false
      : (this.roomsPage.value()?.items.length ?? 0) === PAGE_SIZE,
  );
  readonly isEmpty = computed(
    () => this.roomsPage.status() === 'resolved' && this._rooms().length === 0,
  );

  readonly filteredRooms = computed(() =>
    filterRooms(
      this._rooms(),
      this.categoryFilterEnabled ? this.prefs.categoryId() : null,
      this.prefs.languageId(),
      this.prefs.searchQuery(),
    ),
  );

  protected readonly recommendedResource = rxResource({
    params: () => this._currentType(),
    defaultValue: { items: [] as ChannelListItem[], audienceTotal: 0 } as ChannelListResponse,
    stream: ({ params }) => this.recommendRooms(),
  });
  readonly recommendedRooms = computed<readonly ChannelListItem[]>(
    () => this.recommendedResource.value()?.items ?? [],
  );
  readonly isLoadingRecommended = computed(() => this.recommendedResource.isLoading());
  readonly recommendedError = computed(() => this.recommendedResource.error());

  readonly categories = computed<readonly Category[]>(() => this.categoriesResource.value() ?? []);

  private readonly categoriesResource = rxResource({
    defaultValue: [] as Category[],
    stream: () => this.api.fetchCategories(),
  });

  setRoomType(type: RoomType): void {
    this._currentType.set(type);
    this._offset.set(0);
  }

  loadMore(): void {
    if (this.isLoading() || !this.hasMore() || this.prefs.searchQuery().trim()) return;
    this._offset.update((o) => o + PAGE_SIZE);
  }

  selectCategory(categoryId: number | null): void {
    this.prefs.setCategory(categoryId);
  }

  selectLanguage(langId: number | null): void {
    this._offset.set(0);
    this.prefs.setLanguage(langId);
  }

  setSearchQuery(query: string): void {
    this._offset.set(0);
    this.prefs.setSearchQuery(query);
  }

  refresh(): void {
    this._offset.set(0);
    this.roomsPage.reload();
    this.recommendedResource.reload();
  }

  /** 2 = Voice Rooms, 1 = Live Rooms */
  abstract readonly busiType: number;

  protected abstract listRooms(
    type: RoomType,
    langId: number | null,
    limit: number,
    offset: number,
    refresh: number,
  ): Observable<ChannelListResponse>;

  protected abstract searchRooms(
    query: string,
    langId: number,
    maxPages: number,
  ): Observable<ChannelListResponse>;

  protected abstract recommendRooms(excludeCname?: string): Observable<ChannelListResponse>;

  protected abstract get categoryFilterEnabled(): boolean;
}
