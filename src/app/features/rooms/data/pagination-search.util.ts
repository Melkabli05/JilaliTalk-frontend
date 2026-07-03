import { DestroyRef, signal } from '@angular/core';

const SEARCH_DEBOUNCE_MS = 250;

/**
 * Holds a raw and debounced search-query signal pair. Shared by RoomsStore and
 * LiveRoomsStore, which previously duplicated this debounce timer/signal plumbing
 * identically.
 */
export class SearchDebounce {
  private readonly _query = signal('');
  private readonly _debounced = signal('');
  private timer: ReturnType<typeof setTimeout> | undefined;

  readonly query = this._query.asReadonly();
  readonly debounced = this._debounced.asReadonly();

  constructor(destroyRef: DestroyRef, private readonly delayMs = SEARCH_DEBOUNCE_MS) {
    destroyRef.onDestroy(() => clearTimeout(this.timer));
  }

  set(query: string): void {
    this._query.set(query);
    clearTimeout(this.timer);
    if (!query.trim()) {
      this._debounced.set(query);
      return;
    }
    this.timer = setTimeout(() => this._debounced.set(query), this.delayMs);
  }
}

/**
 * `linkedSignal` computation for an offset-paginated list: resets to the fresh page when
 * the page-defining key (room type, language, …) changes or the offset resets to 0,
 * otherwise appends only items not already present (deduped by `keyOf`). Shared by
 * RoomsStore and LiveRoomsStore.
 */
export function paginateDedup<TSource extends { readonly offset: number; readonly items: readonly TItem[] }, TItem>(
  source: TSource,
  previous: { readonly source: TSource; readonly value: readonly TItem[] } | undefined,
  sameGroup: (a: TSource, b: TSource) => boolean,
  keyOf: (item: TItem) => string,
): readonly TItem[] {
  if (!previous || !sameGroup(previous.source, source) || source.offset === 0) {
    return source.items;
  }
  const existing = new Set(previous.value.map(keyOf));
  const newItems = source.items.filter((item) => !existing.has(keyOf(item)));
  return [...previous.value, ...newItems];
}

/**
 * True when a debounced search has no local matches yet and there's more upstream data to
 * walk — drives the auto-paginate-while-searching effect in both stores.
 */
export function computeIsAutoSearching(params: {
  readonly debouncedQuery: string;
  readonly filteredCount: number;
  readonly hasMore: boolean;
  readonly offset: number;
  readonly maxOffset: number;
}): boolean {
  return (
    params.debouncedQuery.trim().length > 0 &&
    params.filteredCount === 0 &&
    params.hasMore &&
    params.offset < params.maxOffset
  );
}
