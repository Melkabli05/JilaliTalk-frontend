import { Service, inject, signal, computed, linkedSignal, effect, DestroyRef } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { RoomListStore } from './room-list.store';
import { ChannelListItem, ChannelListResponse, RoomType } from '../data/rooms-model';
import { filterRooms } from '../data/room-filter.util';
import { SearchDebounce, paginateDedup } from '../data/pagination-search.util';
import { RoomsApi } from '../data/rooms-api';
import { RoomsPreferencesStore } from '@store/rooms-preferences.store';

const PAGE_SIZE = 20;
const MAX_SEARCH_PAGES = 5;

interface LivePageSource {
  readonly langId: number;
  readonly offset: number;
  readonly items: readonly ChannelListItem[];
}

@Service({ autoProvided: false })
export class LiveRoomsStore extends RoomListStore {
  readonly busiType = 1;

  override readonly roomsPage = rxResource({
    params: () => ({
      offset: this._offset(),
      langId: this.prefs.languageId() ?? 0,
      query: this.search.debounced(),
    }),
    defaultValue: { items: [] as ChannelListItem[], audienceTotal: 0 } as ChannelListResponse,
    stream: ({ params }) =>
      params.query.trim()
        ? this.searchRooms(params.query, params.langId, MAX_SEARCH_PAGES)
        : this.listRooms(RoomType.Live, params.langId, PAGE_SIZE, params.offset, 1),
  });

  override readonly _rooms = linkedSignal<LivePageSource, readonly ChannelListItem[]>({
    source: () => ({
      langId: this.prefs.languageId() ?? 0,
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

  override readonly rooms = this._rooms.asReadonly();
  override readonly selectedLanguageId = this.prefs.languageId;
  override readonly searchQuery = this.prefs.searchQuery;

  constructor() {
    super();
    effect(() => this.search.set(this.prefs.searchQuery()));
  }

  override readonly isLoading = computed(() => this.roomsPage.isLoading());
  override readonly error = computed(() => this.roomsPage.error());
  override readonly hasMore = computed(() =>
    this.prefs.searchQuery().trim()
      ? false
      : (this.roomsPage.value()?.items.length ?? 0) === PAGE_SIZE,
  );
  override readonly isEmpty = computed(
    () => this.roomsPage.status() === 'resolved' && this._rooms().length === 0,
  );

  // Live Rooms has no category-filter UI — always pass null so a category selected on
  // the Voice Rooms page doesn't silently carry over and filter this list.
  override readonly filteredRooms = computed(() =>
    filterRooms(this._rooms(), null, this.prefs.languageId(), this.prefs.searchQuery()),
  );

  override readonly recommendedResource = rxResource({
    defaultValue: { items: [] as ChannelListItem[], audienceTotal: 0 } as ChannelListResponse,
    stream: () => this.api.recommendLiveRooms('moment_tab'),
  });
  override readonly recommendedRooms = computed<readonly ChannelListItem[]>(
    () => this.recommendedResource.value()?.items ?? [],
  );
  override readonly isLoadingRecommended = computed(() => this.recommendedResource.isLoading());
  override readonly recommendedError = computed(() => this.recommendedResource.error());

  protected listRooms(_type: RoomType, langId: number, limit: number, offset: number, refresh: number)
      : Observable<ChannelListResponse> {
    return this.api.listLiveRooms(langId, limit, offset, refresh);
  }

  protected searchRooms(query: string, langId: number, maxPages: number)
      : Observable<ChannelListResponse> {
    return this.api.searchRooms(RoomType.Live, query, langId, maxPages);
  }

  protected recommendRooms(): Observable<ChannelListResponse> {
    return this.api.recommendLiveRooms('moment_tab');
  }

  protected get categoryFilterEnabled(): boolean {
    return false;
  }

  override loadMore(): void {
    if (this.isLoading() || !this.hasMore() || this.prefs.searchQuery().trim()) return;
    this._offset.update((o) => o + PAGE_SIZE);
  }

  override selectLanguage(langId: number | null): void {
    this._offset.set(0);
    this.prefs.setLanguage(langId);
  }

  override setSearchQuery(query: string): void {
    this._offset.set(0);
    this.prefs.setSearchQuery(query);
  }

  override refresh(): void {
    this._offset.set(0);
    this.roomsPage.reload();
    this.recommendedResource.reload();
  }
}
