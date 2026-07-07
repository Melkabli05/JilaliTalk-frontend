import { Service, effect, inject, signal } from '@angular/core';
import { StorageService } from '@core/services/storage.service';

interface RoomsPreferences {
  readonly categoryId: number | null;
  readonly languageId: number | null;
  readonly searchQuery: string;
}

const STORAGE_KEY = 'jtl_rooms_prefs_v1';
const DEFAULTS: RoomsPreferences = { categoryId: null, languageId: null, searchQuery: '' };

/**
 * Persists the room-list filter state (category, language, search query) across
 * page-component mounts and across navigation into/out of individual rooms.
 *
 * The room list stores (RoomsStore / LiveRoomsStore) are provided in the list
 * pages, so navigating to /room/:cname/:busiType destroys them and resets their
 * internal signals on back-nav — this root-provided store is what makes the
 * filter chips survive that trip. Persisted to localStorage so it also
 * survives page reloads.
 */
@Service()
export class RoomsPreferencesStore {
  private readonly storage = inject(StorageService);

  private readonly _categoryId = signal<number | null>(
    this.storage.get<RoomsPreferences>(STORAGE_KEY)?.categoryId ?? DEFAULTS.categoryId,
  );
  private readonly _languageId = signal<number | null>(
    this.storage.get<RoomsPreferences>(STORAGE_KEY)?.languageId ?? DEFAULTS.languageId,
  );
  private readonly _searchQuery = signal<string>(
    this.storage.get<RoomsPreferences>(STORAGE_KEY)?.searchQuery ?? DEFAULTS.searchQuery,
  );

  readonly categoryId = this._categoryId.asReadonly();
  readonly languageId = this._languageId.asReadonly();
  readonly searchQuery = this._searchQuery.asReadonly();

  constructor() {
    effect(() => {
      this.storage.set(STORAGE_KEY, {
        categoryId: this._categoryId(),
        languageId: this._languageId(),
        searchQuery: this._searchQuery(),
      });
    });
  }

  setCategory(id: number | null): void {
    this._categoryId.set(id);
  }

  setLanguage(id: number | null): void {
    this._languageId.set(id);
  }

  setSearchQuery(query: string): void {
    this._searchQuery.set(query);
  }

  clearAll(): void {
    this._categoryId.set(DEFAULTS.categoryId);
    this._languageId.set(DEFAULTS.languageId);
    this._searchQuery.set(DEFAULTS.searchQuery);
  }

  // Session-level hint signals (not persisted — reset on page reload)
  readonly seenInvisibleTooltip = signal(false);
  readonly hasSeenInvisibleBanner = signal(false);
  readonly hasSeenRaiseHandHint = signal(false);

  markInvisibleTooltipSeen(): void { this.seenInvisibleTooltip.set(true); }
  markInvisibleBannerSeen(): void { this.hasSeenInvisibleBanner.set(true); }
  markRaiseHandHintSeen(): void { this.hasSeenRaiseHandHint.set(true); }
}