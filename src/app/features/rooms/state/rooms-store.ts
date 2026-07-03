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
import { ChannelListItem, Category, ChannelListResponse, RoomType, filterRooms } from '../data/rooms-model';
import { SearchDebounce, paginateDedup, computeIsAutoSearching } from '../data/pagination-search.util';

const PAGE_SIZE = 20;
const MAX_SEARCH_OFFSET = PAGE_SIZE * 10;

interface RoomsPageSource {
  readonly type: RoomType;
  readonly langId: number | null;
  readonly offset: number;
  readonly items: readonly ChannelListItem[];
}

@Injectable()
export class RoomsStore {
  private readonly api = inject(RoomsApi);
  private readonly search = new SearchDebounce(inject(DestroyRef));

  private readonly _currentType = signal<RoomType>(RoomType.Voice);
  private readonly _offset = signal(0);
  private readonly _selectedCategoryId = signal<number | null>(null);
  private readonly _selectedLanguageId = signal<number | null>(null);

  private readonly roomsPage = rxResource({
    params: () => ({
      type: this._currentType(),
      offset: this._offset(),
      langId: this._selectedLanguageId() ?? 0,
    }),
    defaultValue: { items: [] as ChannelListItem[], audienceTotal: 0 } as ChannelListResponse,
    stream: ({ params }) =>
      this.api.listRooms(params.type, params.langId, PAGE_SIZE, params.offset, 1),
  });

  private readonly _rooms = linkedSignal<RoomsPageSource, readonly ChannelListItem[]>({
    source: () => ({
      type: this._currentType(),
      langId: this._selectedLanguageId(),
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
  readonly selectedCategoryId = this._selectedCategoryId.asReadonly();
  readonly selectedLanguageId = this._selectedLanguageId.asReadonly();
  readonly searchQuery = this.search.query;

  readonly isLoading = computed(() => this.roomsPage.isLoading());
  readonly error = computed(() => this.roomsPage.error());
  readonly hasMore = computed(() => (this.roomsPage.value()?.items.length ?? 0) === PAGE_SIZE);
  readonly isEmpty = computed(
    () => this.roomsPage.status() === 'resolved' && this._rooms().length === 0,
  );

  readonly isAutoSearching = computed(() =>
    computeIsAutoSearching({
      debouncedQuery: this.search.debounced(),
      filteredCount: this.filteredRooms().length,
      hasMore: this.hasMore(),
      offset: this._offset(),
      maxOffset: MAX_SEARCH_OFFSET,
    }),
  );

  readonly filteredRooms = computed(() =>
    filterRooms(this._rooms(), this._selectedCategoryId(), this._selectedLanguageId(), this.search.debounced()),
  );

  private readonly recommendedResource = rxResource({
    params: () => this._currentType(),
    defaultValue: { items: [] as ChannelListItem[], audienceTotal: 0 } as ChannelListResponse,
    stream: ({ params }) => this.api.recommendRooms(params),
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
    this.search.set(query);
  }

  refresh(): void {
    this._offset.set(0);
    this.roomsPage.reload();
    this.recommendedResource.reload();
  }

  constructor() {
    effect(() => {
      if (this.isAutoSearching() && !this.isLoading()) {
        this.loadMore();
      }
    });
  }
}