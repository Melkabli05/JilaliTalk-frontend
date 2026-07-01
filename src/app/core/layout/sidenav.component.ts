import { Component, ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LucideGlobe, LucideTv, LucideLock, LucideServer, LucideMessageCircle, LucideUser, LucideLogIn } from '@lucide/angular';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { TooltipDirective } from '@shared/directives/tooltip.directive';

type TabType = 'voice' | 'live' | 'private' | 'server' | 'messages' | 'profile';

interface NavItem {
  id: TabType;
  iconName: string;
  label: string;
  badge?: number;
  route: string;
}

interface NavGroup {
  items: NavItem[];
}

@Component({
  selector: 'app-sidenav',

  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [RouterLink, RouterLinkActive, ButtonComponent, TooltipDirective, LucideGlobe, LucideTv, LucideLock, LucideServer, LucideMessageCircle, LucideUser, LucideLogIn],
  template: `
    <a href="#main-content" class="skip-link">Skip to main content</a>

    <nav class="sidebar-desktop" aria-label="Main navigation">
      <div class="sidebar-logo">
        <span class="visually-hidden">JilaliTalk Home</span>
        <svg aria-hidden="true" width="32" height="32" viewBox="0 0 32 32" fill="none">
          <defs>
            <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="var(--color-primary-500)"/>
              <stop offset="100%" stop-color="var(--color-accent-500)"/>
            </linearGradient>
          </defs>
          <path d="M16 4L4 10v12l12 6 12-6V10L16 4z" fill="url(#logoGrad)"/>
          <path d="M16 8l-8 4v8l8 4 8-4v-8l-8-4z" fill="white" fill-opacity="0.2"/>
          <path d="M12 16l4-4 4 4-4 4-4-4z" fill="white"/>
        </svg>
      </div>

      <div class="sidebar-nav">
        @for (group of navGroups; track $index) {
          @for (item of group.items; track item.id) {
            <a
              [routerLink]="item.route"
              routerLinkActive="active"
              class="nav-item"
              [attr.aria-label]="item.label"
              [appTooltip]="item.label"
            >
              @switch (item.iconName) {
                @case ('globe') { <svg aria-hidden="true" lucideGlobe [size]="22"></svg> }
                @case ('tv') { <svg aria-hidden="true" lucideTv [size]="22"></svg> }
                @case ('lock') { <svg aria-hidden="true" lucideLock [size]="22"></svg> }
                @case ('server') { <svg aria-hidden="true" lucideServer [size]="22"></svg> }
                @case ('message') { <svg aria-hidden="true" lucideMessageCircle [size]="22"></svg> }
                @case ('user') { <svg aria-hidden="true" lucideUser [size]="22"></svg> }
              }
              @if (item.badge && item.badge > 0) {
                <span class="nav-badge" aria-label="{{ item.badge }} notifications">{{ item.badge > 9 ? '9+' : item.badge }}</span>
              }
            </a>
          }
          @if ($index < navGroups.length - 1) {
            <div class="nav-separator" role="separator" aria-hidden="true"></div>
          }
        }
      </div>

      <div class="sidebar-footer">
        <app-button variant="ghost" size="sm" aria-label="Profile">
          <svg aria-hidden="true" lucideLogIn [size]="16"></svg>
        </app-button>
      </div>
    </nav>

    <nav class="mobile-nav" aria-label="Main navigation">
      <div class="mobile-nav-inner">
        @for (item of mobileNavItems; track item.id) {
          <a
            [routerLink]="item.route"
            routerLinkActive="active"
            class="mobile-nav-item"
            [attr.aria-label]="item.label"
            [appTooltip]="item.label"
          >
            @switch (item.iconName) {
              @case ('globe') { <svg aria-hidden="true" lucideGlobe [size]="22"></svg> }
              @case ('tv') { <svg aria-hidden="true" lucideTv [size]="22"></svg> }
              @case ('lock') { <svg aria-hidden="true" lucideLock [size]="22"></svg> }
            }
            <span class="mobile-nav-label">{{ item.label === 'Voice Rooms' ? 'Voice' : item.label === 'Live Streams' ? 'Live' : item.label === 'Private Rooms' ? 'Private' : item.label }}</span>
          </a>
        }
      </div>
      <div class="safe-area-spacer"></div>
    </nav>
  `,
  styles: [`
    /* ─── Desktop Sidebar ─────────────────────────────── */
    .sidebar-desktop {
      display: none;
      position: fixed;
      left: 0; top: 0; bottom: 0;
      width: var(--sidebar-width);
      background-color: var(--color-card);
      border-right: 1px solid var(--color-border);
      flex-direction: column;
      z-index: 100;
      padding: var(--space-4);
    }
    @media (min-width: 1024px) { .sidebar-desktop { display: flex; } }

    .sidebar-logo {
      height: var(--space-16);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; margin-bottom: var(--space-4);
    }

    .sidebar-nav {
      flex: 1; display: flex; flex-direction: column; gap: var(--space-1);
      scrollbar-width: none; -ms-overflow-style: none;
    }
    .sidebar-nav::-webkit-scrollbar { display: none; }

    .nav-separator {
      height: 1px; width: var(--space-6);
      margin: var(--space-1) auto;
      background-color: var(--color-border);
      border-radius: var(--radius-full);
    }

    .nav-item {
      position: relative;
      display: flex; align-items: center; justify-content: center;
      width: var(--space-12); height: var(--space-12);
      border-radius: var(--radius-lg);
      color: var(--color-text-muted);
      text-decoration: none;
      transition: background 0.15s ease, color 0.15s ease;
    }
    .nav-item:hover {
      background-color: var(--color-neutral-100);
      color: var(--color-text);
    }
    .nav-item:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }
    .nav-item.active {
      background-color: color-mix(in srgb, var(--color-primary-500) 10%, transparent);
      color: var(--color-primary-600);
    }

    .nav-badge {
      position: absolute; top: var(--space-1); right: var(--space-1);
      min-width: 16px; height: 16px; padding: 0 var(--space-1);
      border-radius: var(--radius-full);
      background-color: var(--color-warm-500);
      color: var(--color-on-color);
      font-size: var(--text-xs); font-weight: var(--font-bold);
      display: flex; align-items: center; justify-content: center;
    }

    .sidebar-footer {
      flex-shrink: 0; display: flex; align-items: center; justify-content: center;
      padding-top: var(--space-2);
      border-top: 1px solid var(--color-border);
      margin-top: var(--space-2);
    }

    /* ─── Mobile Bottom Nav ─────────────────────────── */
    .mobile-nav {
      display: flex; position: fixed; bottom: 0; left: 0; right: 0; z-index: 100;
    }
    @media (min-width: 1024px) { .mobile-nav { display: none; } }

    .mobile-nav-inner {
      width: 100%; height: var(--bottom-nav-height);
      display: flex; align-items: center; justify-content: space-around;
      padding: 0 var(--space-2);
      background-color: color-mix(in srgb, var(--color-card) 90%, transparent);
      backdrop-filter: blur(16px) saturate(180%);
      -webkit-backdrop-filter: blur(16px) saturate(180%);
      border-top: 1px solid var(--color-border);
    }

    .mobile-nav-item {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 2px; padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-xl);
      color: var(--color-text-muted);
      text-decoration: none; font-size: var(--text-xs); font-weight: var(--font-medium);
      transition: background 0.15s ease, color 0.15s ease;
    }
    .mobile-nav-item:hover {
      background-color: var(--color-neutral-100);
      color: var(--color-text);
    }
    .mobile-nav-item:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }
    .mobile-nav-item.active {
      color: var(--color-primary-600);
      font-weight: var(--font-bold);
    }
    .mobile-nav-label { margin-top: var(--space-1); }
    .safe-area-spacer { height: env(safe-area-inset-bottom); background-color: var(--color-card); }

    /* ─── Dark mode ───────────────────────────────── */
    :host-context(.dark) {
      /* Desktop sidebar */
      .sidebar-desktop { background-color: var(--color-neutral-900); border-color: var(--color-neutral-700); }
      .nav-separator { background-color: var(--color-neutral-700); }
      .nav-item { color: var(--color-neutral-500); }
      .nav-item:hover { background-color: var(--color-neutral-800); color: var(--color-text); }
      .nav-item.active { background-color: color-mix(in srgb, var(--color-primary-400) 15%, transparent); color: var(--color-primary-300); }
      .nav-badge { background-color: var(--color-warm-400); }
      .sidebar-footer { border-color: var(--color-neutral-700); }

      /* Mobile nav */
      .mobile-nav-inner {
        background-color: color-mix(in srgb, var(--color-neutral-900) 90%, transparent);
        border-color: var(--color-neutral-700);
      }
      .mobile-nav-item { color: var(--color-neutral-500); }
      .mobile-nav-item:hover { background-color: var(--color-neutral-800); color: var(--color-text); }
      .mobile-nav-item.active { color: var(--color-primary-300); }
      .safe-area-spacer { background-color: var(--color-neutral-900); }
    }
  `]
})
export class SidenavComponent {
  readonly navGroups: NavGroup[] = [
    {
      items: [
        { id: 'voice' as TabType, iconName: 'globe', label: 'Voice Rooms', route: '/rooms/voice' },
        { id: 'live' as TabType, iconName: 'tv', label: 'Live Streams', route: '/rooms/live' },
      ],
    },
    {
      items: [
        { id: 'private' as TabType, iconName: 'lock', label: 'Private Rooms', route: '/rooms/private' },
        { id: 'messages' as TabType, iconName: 'message', label: 'Messages', route: '/messages', badge: 5 },
      ],
    },
    {
      items: [
        { id: 'server' as TabType, iconName: 'server', label: 'Servers', route: '/server', badge: 3 },
      ],
    },
    {
      items: [
        { id: 'profile' as TabType, iconName: 'user', label: 'Profile', route: '/profile' },
      ],
    },
  ];

  readonly mobileNavItems: NavItem[] = [
    { id: 'voice', iconName: 'globe', label: 'Voice Rooms', route: '/rooms/voice' },
    { id: 'live', iconName: 'tv', label: 'Live Streams', route: '/rooms/live' },
    { id: 'private', iconName: 'lock', label: 'Private Rooms', route: '/rooms/private' },
  ];
}
