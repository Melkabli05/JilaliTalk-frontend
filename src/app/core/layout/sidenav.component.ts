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

    <nav class="sidebar-desktop hidden lg:flex" aria-label="Main navigation">
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
                @case ('message') { <svg aria-hidden="true" lucideMessageCircle [size]="22"></svg> }
                @case ('user') { <svg aria-hidden="true" lucideUser [size]="22"></svg> }
              }
              @if (item.id === 'messages' && messagesBadge() > 0) {
                <span class="nav-badge" [attr.aria-label]="messagesBadge() + ' unread'">{{ messagesBadge() > 9 ? '9+' : messagesBadge() }}</span>
              }
            </a>
          }
          @if ($index < navGroups.length - 1) {
            <div class="nav-separator" role="separator" aria-hidden="true"></div>
          }
        }
      </div>

      <div class="sidebar-footer">
        <a
          [routerLink]="'/profile'"
          routerLinkActive="active"
          class="sidebar-profile-link"
          [attr.aria-label]="'Open profile'"
        >
          <svg aria-hidden="true" lucideLogIn [size]="16"></svg>
        </a>
      </div>
    </nav>
  `,
  styles: [`
/* This element has no box of its own: its only child (.sidebar-desktop) is
   fixed-position or display:none, so this host must not consume a track in
   the app-shell grid it sits in as a direct sibling of .main-wrapper —
   without this, on the mobile single-column layout this element would be
   auto-placed into its own implicit grid row, claiming visible space
   despite rendering nothing in normal flow.
   Plain tag selector, not :host: this component uses ViewEncapsulation.None,
   so its styles are already unscoped global CSS — :host (like
   :host-context(), see below) is only rewritten into a working selector
   under the default Emulated encapsulation, and ships as inert,
   non-matching syntax under None. */
    app-sidenav {
      display: contents;
    }

    /* ─── Desktop Sidebar ───────────────────────────────
       Visibility is mobile-first controlled on the template: class="hidden lg:flex" —
       hidden on mobile (the bottom-nav lives there instead), flex from lg upward.
       Below keeps only positioning/look-and-feel + the RTL flip. */
    .sidebar-desktop {
      position: fixed;
      left: 0; top: 0; bottom: 0;
      width: var(--sidebar-width);
      background-color: var(--color-card);
      border-right: 1px solid var(--color-border);
      flex-direction: column;
      z-index: var(--z-shell-sidenav);
      padding: var(--space-4);
    }
    :host-context([dir='rtl']) .sidebar-desktop {
      left: auto; right: 0;
      border-right: none;
      border-left: 1px solid var(--color-border);
    }

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
      background-color: color-mix(in srgb, var(--color-primary-500) 8%, transparent);
      color: var(--color-primary-text);
    }
    .nav-item:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }
    .nav-item.active {
      background-color: color-mix(in srgb, var(--color-primary-500) 12%, transparent);
      color: var(--color-primary-text);
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
    .sidebar-profile-link {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 44px; min-height: 44px; border-radius: var(--radius-lg);
      color: var(--color-text-muted); transition: background-color 0.15s ease, color 0.15s ease;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }
    .sidebar-profile-link:hover { background: var(--color-neutral-100); color: var(--color-text); }
    .sidebar-profile-link:focus-visible { outline: var(--focus-ring); outline-offset: 2px; }
    .sidebar-profile-link.active { color: var(--color-primary-text); }
    :host-context(.dark) .sidebar-profile-link:hover { background: var(--color-neutral-700); }

    /* ─── Dark mode ───────────────────────────────── */
    .dark .sidebar-desktop { background-color: var(--color-neutral-900); border-color: var(--color-neutral-700); }
    .dark .nav-separator { background-color: var(--color-neutral-700); }
    .dark .nav-item { color: var(--color-neutral-500); }
    .dark .nav-item:hover {
      background-color: color-mix(in srgb, var(--color-primary-400) 10%, transparent);
      color: var(--color-primary-300);
    }
    .dark .nav-item.active {
      background-color: color-mix(in srgb, var(--color-primary-400) 18%, transparent);
      color: var(--color-primary-300);
    }
    .dark .nav-badge { background-color: var(--color-warm-400); }
    .dark .sidebar-footer { border-color: var(--color-neutral-700); }
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
