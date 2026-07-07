import { Component, ChangeDetectionStrategy, input, output, signal, computed, effect } from '@angular/core';
import { AudienceUser } from '../models/room-model';
import { UserRole } from '@core/models/user-role';
import { getLanguageById, getLanguageFlag } from '@shared/data/languages';
import { createSearchMatcher, injectIsMobileViewport, partitionBy } from '@shared/utils';
import { AudienceListBarComponent } from './audience-list-bar';
import { AudienceListGridComponent } from './audience-list-grid';
import { ViewMode, LanguageGroup } from './audience-list-shared';

@Component({
  selector: 'app-audience-list',
  imports: [AudienceListBarComponent, AudienceListGridComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.is-collapsed]': 'collapsed()',
  },
  template: `
    <div class="audience-list">
      <app-audience-list-bar
        [totalCount]="totalCount()"
        [filteredCount]="filteredCount()"
        [searchQuery]="searchQuery()"
        [showSearch]="showSearch()"
        [viewMode]="viewMode()"
        [collapsed]="collapsed()"
        (toggleSearch)="toggleSearch()"
        (viewModeChange)="viewMode.set($event)"
        (toggleCollapsed)="toggleCollapsed()"
        (searchInputChange)="searchQuery.set($event)"
        (searchEscape)="onSearchEscape()"
        (clearSearch)="clearSearch()"
      />

      <!-- Always rendered (never @if-removed) so collapse/expand can animate via the
           grid-template-rows 1fr/0fr technique below, instead of the instant
           mount/unmount an @if would give it. -->
      <div class="audience-body" [class.collapsed]="collapsed()">
        <div class="audience-body-inner">
          <app-audience-list-grid
            [viewMode]="viewMode()"
            [displayUsers]="displayUsers()"
            [languageGroups]="languageGroups()"
            [speakingUids]="speakingUids()"
            [canInviteToStage]="canInviteToStage()"
            [inviteBusy]="inviteBusy()"
            [currentUserId]="currentUserId()"
            [searchQuery]="searchQuery()"
            (userClick)="onUserClick($event)"
            (inviteToStage)="onInviteToStage($event)"
            (clearSearch)="clearSearch()"
          />
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      container-type: inline-size;
      container-name: audience-list;
    }

    /* Room-page's audience grid row is minmax(min-content, 22cqh) so a
       collapsed (mobile) or lightly-populated list doesn't reserve a full
       22cqh of blank space. But height: 100% above stretches this host to
       fill whatever the row track resolved to — once collapsed drops the
       body to 0 height, there's nothing left to size the row against except
       that same 100%, so the browser falls back to the track's max (22cqh)
       and leaves the difference as dead space below the header. Switching to
       height: auto while collapsed lets the row shrink to min-content
       (the header alone). */
    :host.is-collapsed {
      height: auto;
    }

    .audience-list {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    /* Collapse animation: grid-template-rows 1fr -> 0fr is the standard CSS-only
       accordion technique — unlike height/max-height, it animates smoothly without
       needing a known target height, and it's what lets the surrounding room-page
       grid (whose audience row is content-sized) and the comments section (which
       absorbs whatever audience frees up) resize smoothly in step, frame by frame,
       with no JS coordination. */
    .audience-body {
      flex: 1 1 auto;
      min-height: 0;
      display: grid;
      grid-template-rows: 1fr;
      transition: grid-template-rows 0.22s ease;
    }
    .audience-body.collapsed {
      grid-template-rows: 0fr;
    }
    .audience-body-inner {
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
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
  readonly collapsed = signal(false);

  private readonly isMobileViewport = injectIsMobileViewport();

  constructor() {
    // Re-applies on every breakpoint crossing (rotate, resize, zoom, devtools
    // open) — same as the matchMedia listener this replaced. A manual
    // toggleCollapsed() call in between crossings is a separate write path
    // and isn't overridden by this effect until the next crossing.
    effect(() => this.collapsed.set(this.isMobileViewport()));
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
    const { matching: ghosts, rest } = partitionBy(users, (u) => !!u.isGhost);
    return [...ghosts, ...rest];
  });

  readonly displayUsers = this.filteredUsers;
  readonly filteredCount = computed(() => this.filteredUsers().length);

  readonly languageGroups = computed<readonly LanguageGroup[]>(() => {
    const users = this.filteredUsers();
    const ghosts = users.filter((u) => u.isGhost);
    const map = new Map<string, LanguageGroup>();
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

  toggleCollapsed(): void {
    this.collapsed.update((v) => !v);
    if (this.collapsed()) {
      this.showSearch.set(false);
      this.searchQuery.set('');
    }
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
