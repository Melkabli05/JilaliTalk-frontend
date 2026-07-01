import { Component, ChangeDetectionStrategy, input, output, signal, computed, viewChild, ElementRef, effect } from '@angular/core';
import { AudienceUserComponent } from '../../ui/audience-user';
import { AudienceUser } from '../../data/room-model';
import { UserRole } from '@core/models/user-role';
import { getLanguageById, getLanguageFlag } from '@shared/data/languages';
import { createSearchMatcher } from '@shared/utils';
import { LucideSearch, LucideX, LucideLayoutGrid, LucideList, LucideUsers } from '@lucide/angular';

type ViewMode = 'grid' | 'list';

@Component({
  selector: 'app-audience-list',

  imports: [AudienceUserComponent, LucideSearch, LucideX, LucideLayoutGrid, LucideList, LucideUsers],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="audience-list">
      <div class="audience-header">
        <div class="header-left">
          <span class="audience-title">Audience</span>
          <span class="audience-count">
            @if (searchQuery()) {
              {{ filteredCount() }} of {{ totalCount() }}
            } @else {
              {{ filteredCount() }}
            }
            {{ filteredCount() === 1 ? 'listener' : 'listeners' }}
          </span>
        </div>
        <div class="header-right">
          <button
            class="tool-btn"
            [class.active]="showSearch()"
            (click)="toggleSearch()"
            [attr.aria-label]="showSearch() ? 'Close search' : 'Search audience'"
          >
            @if (showSearch()) {
              <svg aria-hidden="true" lucideX [size]="12"></svg>
            } @else {
              <svg aria-hidden="true" lucideSearch [size]="12"></svg>
            }
          </button>
          <div class="view-toggle">
            <button
              class="toggle-btn"
              [class.active]="viewMode() === 'grid'"
              [attr.aria-pressed]="viewMode() === 'grid'"
              (click)="viewMode.set('grid')"
              aria-label="Grid view"
            >
              <svg aria-hidden="true" lucideLayoutGrid [size]="11"></svg>
            </button>
            <button
              class="toggle-btn"
              [class.active]="viewMode() === 'list'"
              [attr.aria-pressed]="viewMode() === 'list'"
              (click)="viewMode.set('list')"
              aria-label="List view"
            >
              <svg aria-hidden="true" lucideList [size]="11"></svg>
            </button>
          </div>
        </div>
      </div>

      @if (showSearch()) {
        <div class="search-row">
          <div class="search-box">
            <svg aria-hidden="true" lucideSearch [size]="13" class="search-icon"></svg>
            <input
              #searchInput
              class="search-input"
              type="text"
              placeholder="Search by name or language..."
              [value]="searchQuery()"
              (input)="onSearchInput($event)"
              (keydown.escape)="onSearchEscape()"
              aria-label="Search audience members"
            />
            @if (searchQuery()) {
              <button class="search-clear-btn" type="button" (click)="clearSearch()" aria-label="Clear search">
                <svg aria-hidden="true" lucideX [size]="11"></svg>
              </button>
            }
          </div>
        </div>
      }

      <div class="audience-scroll">
        @if (viewMode() === 'grid') {
          <div class="audience-grid" role="list" [attr.data-count]="gridDisplayCount()">
            @for (user of displayUsers(); track user.userId) {
              <app-audience-user
                [user]="user"
                display="grid"
                [speaking]="speakingUids().includes(user.userId)"
                [canInvite]="canInviteToStage()"
                [inviteBusy]="inviteBusy() === user.userId"
                [currentUserId]="currentUserId()"
                (userClick)="onUserClick($event)"
                (invite)="onInviteToStage($event)"
              />
            }
          </div>
        } @else {
          @for (group of languageGroups(); track group.language) {
            <div class="lang-group">
              <div class="lang-header">
                <span class="lang-flag">{{ group.flag }}</span>
                <span class="lang-name">{{ group.language }}</span>
                <span class="lang-count">{{ group.users.length }}</span>
              </div>
              <div class="lang-users">
                @for (user of group.users; track user.userId) {
                  <app-audience-user
                    [user]="user"
                    display="list"
                    [speaking]="speakingUids().includes(user.userId)"
                    [canInvite]="canInviteToStage()"
                    [inviteBusy]="inviteBusy() === user.userId"
                    [currentUserId]="currentUserId()"
                    (invite)="onInviteToStage($event)"
                  />
                }
              </div>
            </div>
          }
        }

        @if (displayUsers().length === 0) {
          <div class="empty-state">
            <div class="empty-icon">
              <svg aria-hidden="true" lucideUsers [size]="20"></svg>
            </div>
            @if (searchQuery()) {
              <p class="empty-text">No matches for "{{ searchQuery() }}"</p>
              <p class="empty-sub">Try a different name or language</p>
              <button class="clear-search-btn" type="button" (click)="clearSearch()">Clear search</button>
            } @else {
              <p class="empty-text">No listeners yet</p>
              <p class="empty-sub">Share this room to invite people to join the conversation</p>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .audience-list { display: flex; flex-direction: column; height: 100%; }
    .audience-header { display: flex; align-items: center; justify-content: space-between; padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--color-border); flex-shrink: 0; }
    .header-left, .header-right { display: flex; align-items: center; }
    .header-left { gap: var(--space-2); }
    .header-right { gap: var(--space-1); }
    .audience-title { font-size: var(--text-sm); font-weight: var(--font-semibold); color: var(--color-text); }
    .audience-count { font-size: var(--text-xs); color: var(--color-text-secondary); padding: 1px 6px; border-radius: var(--radius-full); background: var(--color-neutral-100); }
    .tool-btn { width: 28px; height: 28px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; background: none; border: none; cursor: pointer; color: var(--color-text-muted); transition: background 0.15s; }
    .tool-btn:hover, .tool-btn.active { background: var(--color-neutral-100); color: var(--color-text); }
    .view-toggle { display: flex; background: var(--color-neutral-100); border-radius: var(--radius-sm); padding: 2px; gap: var(--space-1); }
    .toggle-btn { width: 26px; height: 26px; border-radius: 4px; border: none; display: flex; align-items: center; justify-content: center; background: none; cursor: pointer; color: var(--color-text-muted); transition: background 0.15s; }
    .toggle-btn.active { background: var(--color-card); color: var(--color-primary-600); }
    .search-row { padding: var(--space-1) var(--space-3); border-bottom: 1px solid var(--color-border); }
    .search-box { position: relative; display: flex; align-items: center; }
    .search-icon { position: absolute; left: var(--space-2); color: var(--color-text-muted); pointer-events: none; }
    .search-input { width: 100%; padding: var(--space-1) 28px; border-radius: var(--radius-md); border: 1px solid var(--color-border); background: var(--color-neutral-50); font-size: var(--text-xs); color: var(--color-text); outline: none; }
    .search-input:focus { border-color: var(--color-primary-400); }
    .search-input:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }
    .search-clear-btn {
      position: absolute; right: 4px;
      width: 20px; height: 20px;
      border-radius: var(--radius-full);
      display: flex; align-items: center; justify-content: center;
      background: none; border: none; cursor: pointer;
      color: var(--color-text-muted);
      transition: background 0.15s, color 0.15s;
    }
    .search-clear-btn:hover { background: var(--color-neutral-100); color: var(--color-text); }
    .search-clear-btn:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }
    .audience-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
      gap: var(--space-1);
      align-content: start;
    }

    .audience-grid[data-count='large'] {
      display: flex;
      flex-direction: row;
      overflow-x: auto;
      overflow-y: hidden;
      gap: var(--space-2);
      padding-bottom: var(--space-1);
      scroll-snap-type: x mandatory;
      -webkit-overflow-scrolling: touch;
      max-height: 120px;
      padding-right: var(--space-2);
    }

    .audience-grid[data-count='large'] app-audience-user {
      flex: 0 0 72px;
      scroll-snap-align: start;
    }

    .audience-grid::-webkit-scrollbar {
      height: 6px;
    }
    .audience-grid::-webkit-scrollbar-track {
      background: transparent;
    }
    .audience-grid::-webkit-scrollbar-thumb {
      background: var(--color-neutral-300);
      border-radius: 3px;
    }
    .audience-grid::-webkit-scrollbar-thumb:hover {
      background: var(--color-neutral-400);
    }
    .lang-group { margin-bottom: var(--space-3); }
    .lang-header { display: flex; align-items: center; gap: var(--space-1); margin-bottom: var(--space-2); }
    .lang-flag { font-size: var(--text-sm); }
    .lang-name { font-size: var(--text-xs); font-weight: var(--font-semibold); color: var(--color-text-secondary); }
    .lang-count { font-size: var(--text-2xs); color: var(--color-text-muted); padding: 1px 6px; border-radius: var(--radius-full); background: var(--color-neutral-100); }
    .lang-users { display: flex; flex-direction: column; gap: var(--space-1); }
    .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--space-6); text-align: center; }
    .empty-icon { width: 48px; height: 48px; border-radius: var(--radius-xl); background: var(--color-neutral-100); display: flex; align-items: center; justify-content: center; margin-bottom: var(--space-2); color: var(--color-text-muted); }
    .empty-text { font-size: var(--text-sm); font-weight: var(--font-medium); color: var(--color-text); margin: 0 0 var(--space-1); }
    .empty-sub { font-size: var(--text-xs); color: var(--color-text-muted); max-width: 200px; line-height: 1.5; }
    .clear-search-btn {
      margin-top: var(--space-2); padding: var(--space-1) var(--space-3);
      border-radius: var(--radius-md); border: 1px solid var(--color-border);
      background: var(--color-card); color: var(--color-text); font-size: var(--text-xs);
      font-weight: var(--font-medium); cursor: pointer; transition: background 0.15s;
    }
    .clear-search-btn:hover { background: var(--color-neutral-50); }
    .clear-search-btn:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }

    :host-context(.dark) {
      .tool-btn { color: var(--color-neutral-400); }
      .tool-btn:hover, .tool-btn.active { background: var(--color-neutral-700); color: var(--color-neutral-100); }
      .view-toggle { background: var(--color-neutral-800); }
      .toggle-btn.active { background: var(--color-neutral-700); color: var(--color-primary-300); }
      .audience-count { background: var(--color-neutral-700); color: var(--color-neutral-400); }
      .search-input { background: var(--color-neutral-800); color: var(--color-neutral-200); border-color: var(--color-neutral-700); }
      .search-input::placeholder { color: var(--color-neutral-500); }
      .search-clear-btn:hover { background: var(--color-neutral-700); color: var(--color-neutral-100); }
      .lang-count { background: var(--color-neutral-700); color: var(--color-neutral-400); }
      .empty-icon { background: var(--color-neutral-800); color: var(--color-neutral-400); }
      .empty-text { color: var(--color-neutral-200); }
      .empty-sub { color: var(--color-neutral-400); }
      .clear-search-btn { background: var(--color-neutral-800); border-color: var(--color-neutral-700); color: var(--color-neutral-100); }
      .clear-search-btn:hover { background: var(--color-neutral-700); }
      .audience-grid::-webkit-scrollbar-thumb { background: var(--color-neutral-600); }
      .audience-grid::-webkit-scrollbar-thumb:hover { background: var(--color-neutral-500); }
    }
  `]
})
export class AudienceListComponent {
  readonly users = input<readonly AudienceUser[]>([]);
  readonly speakingUids = input<readonly number[]>([]);
  readonly currentUserId = input<number>(0);
  readonly canInviteToStage = input<boolean>(false);
  readonly inviteBusy = input<number | null>(null);

  readonly userClick = output<AudienceUser>();
  readonly inviteToStage = output<AudienceUser>();

  readonly viewMode = signal<ViewMode>('grid');
  readonly showSearch = signal(false);
  readonly searchQuery = signal('');

  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  constructor() {
    effect(() => {
      if (this.showSearch()) {
        this.searchInput()?.nativeElement.focus();
      }
    });
  }

  private readonly _allListeners = computed(() =>
    this.users().filter((u) => u.role !== UserRole.Host),
  );

  readonly totalCount = computed(() => this._allListeners().length);

  readonly filteredUsers = computed(() => {
    const query = this.searchQuery();
    let users = this._allListeners();
    if (query.trim()) {
      const matcher = createSearchMatcher(query);
      users = users
        .filter((u) =>
          matcher.matches([
            u.base?.nickname,
            u.base?.nativeLang ? getLanguageById(u.base.nativeLang)?.name : null,
          ]),
        )
        .map((u) => ({ user: u, rank: matcher.rank([u.base?.nickname]) }))
        .sort((a, b) => a.rank - b.rank)
        .map(({ user }) => user);
    }
    return [...users.filter((u) => u.isGhost), ...users.filter((u) => !u.isGhost)];
  });

  readonly displayUsers = computed(() => this.filteredUsers());
  readonly filteredCount = computed(() => this.filteredUsers().length);

  readonly gridDisplayCount = computed(() => this.filteredUsers().length > 20 ? 'large' : 'normal');

  readonly languageGroups = computed(() => {
    const users = this.filteredUsers();
    const ghosts = users.filter((u) => u.isGhost);
    const map = new Map<string, { language: string; flag: string; users: AudienceUser[] }>();
    for (const u of users) {
      if (u.isGhost) continue;
      const langId = u.base?.nativeLang ?? -1;
      const langName = getLanguageById(langId)?.name ?? 'Unknown';
      const langFlag = getLanguageFlag(langId);
      if (!map.has(langName)) map.set(langName, { language: langName, flag: langFlag, users: [] });
      map.get(langName)!.users.push(u);
    }
    let groups = Array.from(map.values())
      .sort((a, b) => b.users.length - a.users.length || a.language.localeCompare(b.language));

    const singletons = groups.filter((g) => g.users.length === 1);
    if (singletons.length > 3) {
      const rest = groups.filter((g) => g.users.length > 1);
      const other = singletons.flatMap((g) => g.users);
      groups = [...rest, { language: 'Other languages', flag: '🌐', users: other }];
    }

    return ghosts.length ? [{ language: 'Ghosts', flag: '👻', users: ghosts }, ...groups] : groups;
  });

  toggleSearch(): void {
    this.showSearch.update((v) => !v);
    if (!this.showSearch()) this.searchQuery.set('');
  }

  onSearchInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.searchQuery.set(val);
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }

  onSearchEscape(): void {
    if (this.searchQuery()) {
      this.clearSearch();
    } else {
      this.toggleSearch();
    }
  }

  onUserClick(user: AudienceUser): void {
    this.userClick.emit(user);
  }

  onInviteToStage(user: AudienceUser): void {
    this.inviteToStage.emit(user);
  }
}