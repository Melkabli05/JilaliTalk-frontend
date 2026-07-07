import { Service, signal } from '@angular/core';

/**
 * Base for stores that manage a single read-only collection.
 * Provides the common signal + setter + reset pattern shared by
 * {@link StageStore}, {@link AudienceStore}, {@link CommentsStore}, and others.
 *
 * @example
 * ```ts
 * // Page-scoped subclass (the common case — see CLAUDE.md §7):
 * @Service({ autoProvided: false })
 * export class MyStore extends CollectionStore<MyItem> {
 *   readonly items = this.collection;
 *
 *   updateItems(items: MyItem[]): void {
 *     this.setCollection(items);
 *   }
 * }
 * ```
 */
@Service({ autoProvided: false })
export class CollectionStore<T> {
  protected readonly collection = signal<readonly T[]>([]);

  readonly items = this.collection;

  setCollection(items: T[]): void {
    this.collection.set(items);
  }

  reset(): void {
    this.collection.set([]);
  }
}

export function partitionBy<T>(
  items: readonly T[],
  predicate: (item: T) => boolean,
): { matching: T[]; rest: T[] } {
  const matching: T[] = [];
  const rest: T[] = [];
  for (const item of items) {
    (predicate(item) ? matching : rest).push(item);
  }
  return { matching, rest };
}
