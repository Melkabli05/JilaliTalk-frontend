import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { Tabs, TabList, Tab, TabPanel, TabContent } from '@angular/aria/tabs';
import { ProfileStore } from '../store/profile.store';
import { ProfileHeaderComponent } from '../ui/profile-header';
import { ProfileStatsBarComponent } from '../ui/profile-stats-bar';
import { UserListItemComponent } from '@shared/ui/user-list/user-list-item';
import { BlockedListComponent } from '../ui/blocked-list';
import { ButtonComponent } from '@shared/ui/button/button.component';

type ProfileTab = 'followers' | 'following' | 'visitors' | 'blocked';

@Component({
  selector: 'app-profile-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ProfileStore],
  imports: [
    Tabs,
    TabList,
    Tab,
    TabPanel,
    TabContent,
    ProfileHeaderComponent,
    ProfileStatsBarComponent,
    UserListItemComponent,
    BlockedListComponent,
    ButtonComponent,
  ],
  template: `
    <div class="profile-page">
      @if (store.bundleLoading() && !store.userInfo()) {
        <div class="header-skeleton">
          <div class="skeleton-avatar"></div>
          <div class="skeleton-lines">
            <div class="skeleton-line skeleton-line--wide"></div>
            <div class="skeleton-line"></div>
          </div>
        </div>
      } @else if (store.bundleError(); as err) {
        <div class="error-state">
          <p>{{ err }}</p>
          <app-button variant="soft-neutral" size="sm" (click)="store.reloadBundle()">Retry</app-button>
        </div>
      } @else {
        <app-profile-header [info]="store.userInfo()" />

        <app-profile-stats-bar
          [followers]="store.userInfo()?.details?.relation?.followers ?? 0"
          [following]="store.userInfo()?.details?.relation?.following ?? 0"
          [moments]="store.stats()?.totalMntCount ?? 0"
          [likes]="store.userInfo()?.details?.relation?.likes ?? 0"
          (followersClick)="selectTab('followers')"
          (followingClick)="selectTab('following')"
        />
      }

      <div class="tabs-section" ngTabs>
        <ul ngTabList class="tabs" [(selectedTab)]="activeTab" (selectedTabChange)="onTabChange($event)">
          <li ngTab value="followers" class="tab-btn">Followers</li>
          <li ngTab value="following" class="tab-btn">Following</li>
          <li ngTab value="visitors" class="tab-btn">Visitors</li>
          <li ngTab value="blocked" class="tab-btn">Blocked</li>
        </ul>

        <div ngTabPanel value="followers" class="tab-panel">
          <ng-template ngTabContent>
            @if (store.followersLoading() && store.followers().length === 0) {
              <div class="list-skeleton">
                @for (i of [1, 2, 3]; track i) {
                  <div class="skeleton-row"></div>
                }
              </div>
            } @else if (store.followersError(); as err) {
              <div class="error-state"><p>{{ err }}</p></div>
            } @else if (store.followers().length === 0) {
              <div class="empty-state"><p>No followers yet</p></div>
            } @else {
              @for (user of store.followers(); track user.userId) {
                <app-user-list-item
                  variant="followers"
                  [name]="user.nickName ?? 'User'"
                  [headUrl]="user.headUrl"
                  [nationality]="user.nationality"
                  [vipType]="user.vipType"
                />
              }
              @if (store.followersMore()) {
                <app-button variant="soft-neutral" size="sm" (click)="store.loadMoreFollowers()">
                  Load more
                </app-button>
              }
            }
          </ng-template>
        </div>

        <div ngTabPanel value="following" class="tab-panel">
          <ng-template ngTabContent>
            @if (store.followingLoading() && store.following().length === 0) {
              <div class="list-skeleton">
                @for (i of [1, 2, 3]; track i) {
                  <div class="skeleton-row"></div>
                }
              </div>
            } @else if (store.followingError(); as err) {
              <div class="error-state"><p>{{ err }}</p></div>
            } @else if (store.following().length === 0) {
              <div class="empty-state"><p>You're not following anyone yet</p></div>
            } @else {
              @for (user of store.following(); track user.userId) {
                <app-user-list-item
                  variant="following"
                  [name]="user.nickName ?? 'User'"
                  [headUrl]="user.headUrl"
                  [nationality]="user.nationality"
                  [vipType]="user.vipType"
                  [isMutual]="user.isMutual"
                />
              }
            }
          </ng-template>
        </div>

        <div ngTabPanel value="visitors" class="tab-panel">
          <ng-template ngTabContent>
            @if (store.visitorsLoading() && store.visitors().length === 0) {
              <div class="list-skeleton">
                @for (i of [1, 2, 3]; track i) {
                  <div class="skeleton-row"></div>
                }
              </div>
            } @else if (store.visitorsError(); as err) {
              <div class="error-state"><p>{{ err }}</p></div>
            } @else if (store.visitors().length === 0) {
              <div class="empty-state"><p>No visitors yet</p></div>
            } @else {
              @for (user of store.visitors(); track user.userid) {
                <app-user-list-item
                  variant="visitors"
                  [name]="user.nickname ?? 'User'"
                  [headUrl]="user.headUrl"
                  [nationality]="user.nationality"
                  [visitTs]="user.visitTs"
                  [visitCnt]="user.visitCnt"
                />
              }
              @if (store.visitorsMore()) {
                <app-button variant="soft-neutral" size="sm" (click)="store.loadMoreVisitors()">
                  Load more
                </app-button>
              }
            }
          </ng-template>
        </div>

        <div ngTabPanel value="blocked" class="tab-panel">
          <ng-template ngTabContent>
            @if (store.blockedLoading()) {
              <div class="list-skeleton">
                @for (i of [1, 2]; track i) {
                  <div class="skeleton-row"></div>
                }
              </div>
            } @else if (store.blockedError(); as err) {
              <div class="error-state"><p>{{ err }}</p></div>
            } @else {
              <app-blocked-list [users]="store.blocked()" />
            }
          </ng-template>
        </div>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      container-type: inline-size;
      container-name: profile-page;
    }

    .profile-page {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      padding: var(--space-4);
      max-width: 720px;
      margin: 0 auto;
    }

    .tabs-section {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .tabs {
      display: flex;
      gap: var(--space-1);
      list-style: none;
      margin: 0;
      padding: var(--space-1);
      background: var(--color-neutral-100);
      border-radius: var(--radius-full);
      width: fit-content;
    }
    :host-context(.dark) .tabs {
      background: var(--color-neutral-800);
    }

    .tab-btn {
      padding: var(--space-2) var(--space-4);
      border-radius: var(--radius-full);
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--color-text-muted);
      cursor: pointer;
      transition: background-color 0.15s ease, color 0.15s ease;
    }
    .tab-btn[aria-selected='true'] {
      background: var(--color-card);
      color: var(--color-primary-600);
    }
    :host-context(.dark) .tab-btn {
      color: var(--color-neutral-400);
    }
    :host-context(.dark) .tab-btn[aria-selected='true'] {
      background: var(--color-neutral-700);
      color: var(--color-primary-300);
    }

    .tab-panel {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .empty-state,
    .error-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-8) var(--space-4);
      color: var(--color-text-muted);
      font-size: var(--text-sm);
    }
    :host-context(.dark) .empty-state,
    :host-context(.dark) .error-state {
      color: var(--color-neutral-400);
    }

    .header-skeleton {
      display: flex;
      gap: var(--space-4);
      padding: var(--space-5);
    }
    .skeleton-avatar {
      width: 80px;
      height: 80px;
      border-radius: var(--radius-full);
      background: linear-gradient(90deg, var(--color-neutral-200) 25%, var(--color-neutral-100) 50%, var(--color-neutral-200) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
      flex-shrink: 0;
    }
    .skeleton-lines {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      justify-content: center;
    }
    .skeleton-line {
      height: 14px;
      width: 50%;
      border-radius: var(--radius-sm);
      background: linear-gradient(90deg, var(--color-neutral-200) 25%, var(--color-neutral-100) 50%, var(--color-neutral-200) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
    }
    .skeleton-line--wide {
      width: 70%;
      height: 18px;
    }
    .skeleton-row {
      height: 48px;
      border-radius: var(--radius-lg);
      background: linear-gradient(90deg, var(--color-neutral-200) 25%, var(--color-neutral-100) 50%, var(--color-neutral-200) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
    }
    .list-skeleton {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }
    :host-context(.dark) .skeleton-avatar,
    :host-context(.dark) .skeleton-line,
    :host-context(.dark) .skeleton-row {
      background: linear-gradient(90deg, var(--color-neutral-700) 25%, var(--color-neutral-600) 50%, var(--color-neutral-700) 75%);
      background-size: 200% 100%;
    }
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .skeleton-avatar, .skeleton-line, .skeleton-row { animation: none; }
    }
  `,
})
export class ProfilePageComponent {
  protected readonly store = inject(ProfileStore);

  protected readonly activeTab = signal<ProfileTab>('followers');

  constructor() {
    this.onTabChange(this.activeTab());
  }

  protected selectTab(tab: ProfileTab): void {
    this.activeTab.set(tab);
    this.onTabChange(tab);
  }

  protected onTabChange(tab: ProfileTab): void {
    switch (tab) {
      case 'followers':
        this.store.activateFollowersTab();
        break;
      case 'following':
        this.store.activateFollowingTab();
        break;
      case 'visitors':
        this.store.activateVisitorsTab();
        break;
      case 'blocked':
        this.store.activateBlockedTab();
        break;
    }
  }
}
