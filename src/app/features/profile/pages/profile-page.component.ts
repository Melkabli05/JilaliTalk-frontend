import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { Tabs, TabList, Tab, TabPanel, TabContent } from '@angular/aria/tabs';
import { Dialog } from '@angular/cdk/dialog';
import { ProfileStore } from '../store/profile.store';
import { ProfileHeaderComponent } from '../ui/profile-header';
import { ProfileStatsBarComponent } from '../ui/profile-stats-bar';
import { UserListItemComponent } from '@shared/ui/user-list/user-list-item';
import { BlockedListComponent } from '../ui/blocked-list';
import { ButtonComponent } from '@shared/ui/button/button.component';
import {
  UserInfoModalComponent,
  UserInfoModalData,
} from '@shared/ui/user-info-modal/user-info-modal.component';
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
  templateUrl: './profile-page.component.html',
  styleUrl: './profile-page.component.scss',
})
export class ProfilePageComponent {
  protected readonly store = inject(ProfileStore);
  private readonly dialog = inject(Dialog);
  protected readonly activeTab = signal<ProfileTab>('followers');
  constructor() {
    this.onTabChange(this.activeTab());
  }
  protected onViewProfile(
    userId: number,
    nickname: string | null,
    headUrl: string | null,
    nationality: string | null,
  ): void {
    this.dialog.open(UserInfoModalComponent, {
      data: { userId, nickname, headUrl, nationality } satisfies UserInfoModalData,
      backdropClass: 'app-modal-backdrop',
    });
  }
  protected selectTab(tab: ProfileTab): void {
    this.activeTab.set(tab);
    this.onTabChange(tab);
  }
  protected onTabChange(tab: string | undefined): void {
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
