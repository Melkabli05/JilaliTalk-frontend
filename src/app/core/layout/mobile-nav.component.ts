import { Component, ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core';
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
    <nav class="mobile-nav" aria-label="Main navigation">
      <div class="mobile-nav-inner">
        @for (item of navItems; track item.id) {
          <a
            [routerLink]="item.route"
            routerLinkActive="active"
            class="mobile-nav-item"
            [attr.aria-label]="item.label"
          >
            @switch (item.iconName) {
              @case ('globe') { <svg aria-hidden="true" lucideGlobe [size]="22"></svg> }
              @case ('tv') { <svg aria-hidden="true" lucideTv [size]="22"></svg> }
              @case ('message') { <svg aria-hidden="true" lucideMessageCircle [size]="22"></svg> }
              @case ('user') { <svg aria-hidden="true" lucideUser [size]="22"></svg> }
            }
            @if (item.badge && item.badge > 0) {
              <span class="nav-badge mobile-nav-badge" aria-label="{{ item.badge }} notifications">{{ item.badge > 9 ? '9+' : item.badge }}</span>
            }
            <span class="mobile-nav-label">{{ mobileLabel(item.label) }}</span>
          </a>
        }
      </div>
      <div class="safe-area-spacer"></div>
    </nav>
  `,
  styles: [`
/* Plain tag selector, not :host: this component uses ViewEncapsulation.None, so
   its styles are already unscoped global CSS — :host is only rewritten into a
   working selector under the default Emulated encapsulation, and ships as
   inert, non-matching syntax under None. Without this, this host would be a
   real block-level grid item as a direct sibling of .main-wrapper in
   app-shell's grid, claiming an extra implicit row despite its only child
   being fixed-position. */
    app-mobile-nav {
      display: contents;
    }

    /* ─── Mobile Bottom Nav ─────────────────────────── */
    .mobile-nav {
      display: flex; flex-direction: column; position: fixed; bottom: 0; left: 0; right: 0;
      z-index: var(--z-shell-sidenav);
      background-color: color-mix(in srgb, var(--color-card) 92%, transparent);
      backdrop-filter: blur(16px) saturate(180%);
      -webkit-backdrop-filter: blur(16px) saturate(180%);
      border-top: 1px solid var(--color-border);
    }
    .dark .mobile-nav {
      background-color: color-mix(in srgb, var(--color-neutral-900) 92%, transparent);
      border-color: var(--color-neutral-700);
    }
    @media (min-width: 1024px) { .mobile-nav { display: none; } }
    /* Immersive routes (mobile room pages) hide the bottom nav so the room gets the
       full viewport height. Desktop sidebar is unaffected.
       Plain ancestor selector, not :host-context: see the ViewEncapsulation.None
       note above. */
    @media (max-width: 1023.98px) {
      .app-shell.immersive .mobile-nav {
        display: none;
      }
    }

    .mobile-nav-inner {
      width: 100%; height: var(--bottom-nav-height);
      display: flex; align-items: center; justify-content: space-around;
      padding: 0 var(--space-2);
    }

    .mobile-nav-item {
      position: relative;
      flex: 1; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 2px; padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-xl);
      color: var(--color-text-muted);
      text-decoration: none; font-size: var(--text-xs); font-weight: var(--font-medium);
      transition: background 0.15s ease, color 0.15s ease;
      user-select: none;
      -webkit-user-select: none;
      -webkit-touch-callout: none;
    }
    .mobile-nav-item:hover {
      background-color: color-mix(in srgb, var(--color-primary-500) 8%, transparent);
      color: var(--color-primary-text);
    }
    .mobile-nav-item:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-ring-offset); }
    .mobile-nav-item.active {
      color: var(--color-primary-text);
      font-weight: var(--font-bold);
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

    .mobile-nav-label { margin-top: var(--space-1); }
    .safe-area-spacer { width: 100%; height: env(safe-area-inset-bottom); }

    /* ─── Dark mode ───────────────────────────────── */
    .dark .mobile-nav-item { color: var(--color-neutral-500); }
    .dark .mobile-nav-item:hover {
      background-color: color-mix(in srgb, var(--color-primary-400) 10%, transparent);
      color: var(--color-primary-300);
    }
    .dark .mobile-nav-item.active { color: var(--color-primary-300); }
    .dark .nav-badge { background-color: var(--color-warm-400); }
      `]
})
export class MobileNavComponent {
  readonly navItems: NavItem[] = [
    { id: 'voice', iconName: 'globe', label: 'Voice Rooms', route: '/rooms/voice' },
    { id: 'live', iconName: 'tv', label: 'Live Streams', route: '/rooms/live' },
    { id: 'messages', iconName: 'message', label: 'Messages', route: '/messages', badge: 5 },
    { id: 'profile', iconName: 'user', label: 'Profile', route: '/profile' },
  ];

  protected readonly mobileLabel = mobileLabel;
}
