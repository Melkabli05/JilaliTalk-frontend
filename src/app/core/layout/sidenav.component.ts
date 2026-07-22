import { Component, ChangeDetectionStrategy, ViewEncapsulation, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LucideGlobe, LucideTv, LucideLock, LucideMessageCircle, LucideUser, LucideLogIn } from '@lucide/angular';
import { TooltipDirective } from '@shared/directives/tooltip.directive';
import { NotificationStore } from '@store/notification.store';

type TabType = 'voice' | 'live' | 'private' | 'messages' | 'profile';

interface NavItem {
  id: TabType;
  iconName: string;
  label: string;
  route: string;
}

interface NavGroup {
  items: NavItem[];
}

@Component({
  selector: 'app-sidenav',

  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [RouterLink, RouterLinkActive, TooltipDirective, LucideGlobe, LucideTv, LucideLock, LucideMessageCircle, LucideUser, LucideLogIn],
  template: `
    <a href="#main-content" class="skip-link">Skip to main content</a>

    <nav
      class="sidebar-desktop hidden lg:flex flex-col
             bg-white dark:bg-neutral-900
             border-r border-neutral-200 dark:border-neutral-700
             p-4
             rtl:lg:left-auto rtl:lg:right-0 rtl:lg:border-r-0 rtl:lg:border-l"
      aria-label="Main navigation"
    >
      <div class="h-16 flex items-center justify-center shrink-0 mb-4">
        <span class="visually-hidden">JilaliTalk Home</span>
        <svg aria-hidden="true" width="32" height="32" viewBox="0 0 32 32" fill="none">
          <defs>
            <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#2563eb"/>
              <stop offset="100%" stop-color="#4f46e5"/>
            </linearGradient>
          </defs>
          <path d="M16 4L4 10v12l12 6 12-6V10L16 4z" fill="url(#logoGrad)"/>
          <path d="M16 8l-8 4v8l8 4 8-4v-8l-8-4z" fill="white" fill-opacity="0.2"/>
          <path d="M12 16l4-4 4 4-4 4-4-4z" fill="white"/>
        </svg>
      </div>

      <div class="flex-1 flex flex-col gap-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        @for (group of navGroups; track $index) {
          @for (item of group.items; track item.id) {
            <a
              [routerLink]="item.route"
              routerLinkActive="active"
              class="nav-item relative flex items-center justify-center size-12 rounded-lg
                     text-neutral-500 dark:text-neutral-500
                     no-underline transition-colors duration-150
                     hover:bg-blue-500/8 hover:text-blue-600
                     dark:hover:bg-blue-400/10 dark:hover:text-blue-300
                     focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500
                     [&.active]:bg-blue-500/12 [&.active]:text-blue-600
                     dark:[&.active]:bg-blue-400/18 dark:[&.active]:text-blue-300"
              [attr.aria-label]="item.label"
              [appTooltip]="item.label"
            >
              @switch (item.iconName) {
                @case ('globe') { <svg aria-hidden="true" lucideGlobe [size]="22"></svg> }
                @case ('tv') { <svg aria-hidden="true" lucideTv [size]="22"></svg> }
                @case ('lock') { <svg aria-hidden="true" lucideLock [size]="22"></svg> }
                @case ('message') { <svg aria-hidden="true" lucideMessageCircle [size]="22"></svg> }
                @case ('user') { <svg aria-hidden="true" lucideUser [size]="22"></svg> }
              }
              @if (item.id === 'messages' && messagesBadge() > 0) {
                <span
                  class="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full
                         bg-red-500 dark:bg-red-400 text-white text-xs font-bold
                         flex items-center justify-center"
                  [attr.aria-label]="messagesBadge() + ' unread'"
                >{{ messagesBadge() > 9 ? '9+' : messagesBadge() }}</span>
              }
            </a>
          }
          @if ($index < navGroups.length - 1) {
            <div class="h-px w-6 my-1 mx-auto bg-neutral-200 dark:bg-neutral-700 rounded-full" role="separator" aria-hidden="true"></div>
          }
        }
      </div>

      <div class="shrink-0 flex items-center justify-center pt-2 mt-2 border-t border-neutral-200 dark:border-neutral-700">
        <a
          [routerLink]="'/profile'"
          routerLinkActive="active"
          class="inline-flex items-center justify-center min-h-11 min-w-11 rounded-lg
                 text-neutral-500 dark:text-neutral-500
                 transition-colors duration-150
                 [touch-action:manipulation] [-webkit-tap-highlight-color:transparent]
                 hover:bg-neutral-100 hover:text-neutral-900
                 dark:hover:bg-neutral-700 dark:hover:text-neutral-100
                 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500
                 [&.active]:text-blue-600 dark:[&.active]:text-blue-300"
          [attr.aria-label]="'Open profile'"
        >
          <svg aria-hidden="true" lucideLogIn [size]="16"></svg>
        </a>
      </div>
    </nav>
  `,
  /**
   * Only structural/functional CSS remains — colors/spacing/radii/typography moved to
   * Tailwind v4 utilities + the default palette in the template above.
   *   - app-sidenav { display: contents } — required so this host doesn't consume a track
   *     in the app-shell grid (see the long-form comment this replaced: its only child is
   *     fixed-position/display:none, so it must never be a grid item itself).
   *   - .sidebar-desktop position/width/z-index — position:fixed + width from
   *     --sidebar-width + z-index from --z-shell-sidenav are cross-component layout
   *     coordination (app.ts reads --sidebar-width for the main-wrapper margin), not
   *     branding/color choices.
   */
  styles: [`
    app-sidenav { display: contents; }
    .sidebar-desktop {
      position: fixed;
      left: 0; top: 0; bottom: 0;
      width: var(--sidebar-width);
      z-index: var(--z-shell-sidenav);
    }
  `]
})
export class SidenavComponent {
  private readonly notificationStore = inject(NotificationStore);
  protected readonly messagesBadge = computed(() => this.notificationStore.unreadCount());

  readonly navGroups: NavGroup[] = [
    {
      items: [
        { id: 'voice' as TabType, iconName: 'globe', label: 'Voice Rooms', route: '/rooms/voice' },
        { id: 'live' as TabType, iconName: 'tv', label: 'Live Streams', route: '/rooms/live' },
      ],
    },
    {
      items: [
        { id: 'private' as TabType, iconName: 'lock', label: 'Private Rooms', route: '/rooms/voice' },
        { id: 'messages' as TabType, iconName: 'message', label: 'Messages', route: '/messages' },
      ],
    },
    {
      items: [
        { id: 'profile' as TabType, iconName: 'user', label: 'Profile', route: '/profile' },
      ],
    },
  ];
}
