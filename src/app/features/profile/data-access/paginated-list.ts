import { DestroyRef, signal, type WritableSignal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { Observable } from 'rxjs';

export interface CursorPage<TItem, TCursor> {
  readonly list: readonly TItem[];
  readonly nextCursor: TCursor;
  readonly more: boolean;
}

/**
 * Cursor-paginated "load more" list state, generic over the item type and cursor type.
 * Extracted out of `ProfileStore`, which used to have two ~45-line copies of this exact
 * state machine (one for followers, one for visitors) differing only in item/cursor type and
 * which API method to call — a textbook case for a single reusable primitive instead of
 * copy-pasted signals.
 *
 * This exists as its own class rather than `rxResource` because `rxResource` *replaces*
 * `value()` on every params change, which is correct for "refetch the same thing" but wrong
 * for "append the next page": swapping the cursor into a resource's params would silently
 * replace the visible list with just the next page instead of growing it (the bug this class
 * was introduced to fix). Open for reuse by any future paginated list in this feature (or
 * elsewhere, if promoted to `shared/`) without modifying this class — only a `fetchPage`
 * function needs to be supplied, not new branching inside it.
 */
export class PaginatedList<TItem, TCursor> {
  private readonly _items = signal<readonly TItem[]>([]);
  private readonly _cursor: WritableSignal<TCursor>;
  private readonly _more = signal(false);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private activated = false;

  readonly items = this._items.asReadonly();
  readonly more = this._more.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  constructor(
    private readonly initialCursor: TCursor,
    private readonly fetchPage: (cursor: TCursor) => Observable<CursorPage<TItem, TCursor>>,
    private readonly errorMessage: string,
    private readonly destroyRef: DestroyRef,
  ) {
    this._cursor = signal(initialCursor);
  }

  /** Fetches the first page, but only the first time — repeat calls (e.g. switching back to
   *  an already-visited tab) are a no-op, matching the idempotency `rxResource` gave the
   *  lists this class replaced for free (setting an unchanged params signal doesn't refetch). */
  activate(): void {
    if (this.activated) return;
    this.activated = true;
    this.fetch(true);
  }

  /** Ignored while a fetch is already in flight, so a double-click can't race two page
   *  fetches into the accumulator in an unpredictable order. */
  loadMore(): void {
    if (this._loading()) return;
    this.fetch(false);
  }

  private fetch(reset: boolean): void {
    this._loading.set(true);
    this._error.set(null);
    const cursor = reset ? this.initialCursor : this._cursor();
    this.fetchPage(cursor)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this._items.update((acc) => (reset ? [...page.list] : [...acc, ...page.list]));
          this._cursor.set(page.nextCursor);
          this._more.set(page.more);
          this._loading.set(false);
        },
        error: () => {
          this._loading.set(false);
          this._error.set(this.errorMessage);
        },
      });
  }
}
