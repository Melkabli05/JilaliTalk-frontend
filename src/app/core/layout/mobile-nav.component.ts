import { Component, ChangeDetectionStrategy, ViewEncapsulation, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LucideGlobe, LucideTv, LucideMessageCircle, LucideUser } from '@lucide/angular';

type TabType = 'voice' | 'live' | 'messages' | 'profile';

interface NavItem {
  id: TabType;
  iconName: string;
  label: string;
  badge?: number;
  route: string;
}

/** Short labels so four items fit at typical mobile widths without crowding. */
function mobileLabel(full: string): string {
  switch (full) {
    case 'Voice Rooms': return 'Voice';
    case 'Live Streams': return 'Live';
    default: return full;
  }
}

@Component({
  selector: 'app-mobile-nav',

  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [RouterLink, RouterLinkActive, LucideGlobe, LucideTv, LucideMessageCircle, LucideUser],
  template: `
    <nav
      class="mobile-nav flex flex-col fixed bottom-0 left-0 right-0
             bg-white/92 dark:bg-neutral-900/92
             backdrop-blur-lg backdrop-saturate-150
             border-t border-neutral-200 dark:border-neutral-700"
      aria-label="Main navigation"
      [class.immersive]="immersive()"
    >
      <div class="mobile-nav-inner w-full flex items-center justify-around px-2">
        @for (item of navItems; track item.id) {
          <a
            [routerLink]="item.route"
            routerLinkActive="active"
            class="relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2 px-3
                   rounded-xl text-neutral-500 dark:text-neutral-500
                   no-underline text-xs font-medium
                   transition-colors duration-150
                   select-none [-webkit-touch-callout:none]
                   hover:bg-blue-500/8 hover:text-blue-600
                   dark:hover:bg-blue-400/10 dark:hover:text-blue-300
                   focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500
                   [&.active]:text-blue-600 [&.active]:font-bold
                   dark:[&.active]:text-blue-300"
            [attr.aria-label]="item.label"
          >
            @switch (item.iconName) {
              @case ('globe') { <svg aria-hidden="true" lucideGlobe [size]="22"></svg> }
              @case ('tv') { <svg aria-hidden="true" lucideTv [size]="22"></svg> }
              @case ('message') { <svg aria-hidden="true" lucideMessageCircle [size]="22"></svg> }
              @case ('user') { <svg aria-hidden="true" lucideUser [size]="22"></svg> }
            }
            @if (item.badge && item.badge > 0) {
              <span
                class="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full
                       bg-red-500 dark:bg-red-400 text-white text-xs font-bold
                       flex items-center justify-center"
                aria-label="{{ item.badge }} notifications"
              >{{ item.badge > 9 ? '9+' : item.badge }}</span>
            }
            <span class="mt-1">{{ mobileLabel(item.label) }}</span>
          </a>
        }
      </div>
      <div class="w-full [height:env(safe-area-inset-bottom)]"></div>
    </nav>
  `,
  /**
   * Only structural/functional CSS remains — colors/spacing/radii/typography moved to
   * Tailwind v4 utilities + the default palette in the template above.
   */
  styles: [`
    app-mobile-nav { display: contents; }
    .mobile-nav { z-index: var(--z-shell-sidenav); }
    .mobile-nav.immersive { display: none; }
    .mobile-nav-inner { height: var(--bottom-nav-height); }
  `]
})
export class MobileNavComponent {
  /** Bound by the shell: true when the route is immersive AND the viewport is mobile.
   *  The bottom nav is suppressed in that mode so the room gets the full viewport height. */
  readonly immersive = input(false);

  readonly navItems: NavItem[] = [
    { id: 'voice', iconName: 'globe', label: 'Voice Rooms', route: '/rooms/voice' },
    { id: 'live', iconName: 'tv', label: 'Live Streams', route: '/rooms/live' },
    { id: 'messages', iconName: 'message', label: 'Messages', route: '/messages', badge: 5 },
    { id: 'profile', iconName: 'user', label: 'Profile', route: '/profile' },
  ];

  protected readonly mobileLabel = mobileLabel;
}
