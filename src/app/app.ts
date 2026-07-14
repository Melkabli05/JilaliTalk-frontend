import { Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet, type ActivatedRouteSnapshot } from '@angular/router';
import { filter, map } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { SidenavComponent } from '@core/layout/sidenav.component';
import { MobileNavComponent } from '@core/layout/mobile-nav.component';
import { HeaderComponent } from '@core/layout/header.component';
import { MinimizedRoomBarComponent } from '@core/layout/minimized-room-bar.component';
import { ImBootstrapService } from '@core/realtime/im-bootstrap.service';
import { ToastContainerComponent } from '@shared/ui/toast/toast-container.component';
import { PwaUpdateBannerComponent } from '@shared/ui';
import { NotificationToastComponent } from '@shared/ui/notification-panel';
import { PwaUpdateService } from '@core/services/pwa-update.service';
import { ActiveCallStore } from '@store/active-call.store';
import { injectIsMobileViewport } from '@shared/utils';

function isRouteFlagSet(root: ActivatedRouteSnapshot, key: 'immersive' | 'standalone' | 'fullscreen'): boolean {
  let node = root;
  while (node.firstChild) node = node.firstChild;
  return node.data[key] === true;
}

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, SidenavComponent, MobileNavComponent, HeaderComponent, ToastContainerComponent, PwaUpdateBannerComponent, MinimizedRoomBarComponent, NotificationToastComponent],
  template: `
    <div class="app-shell" [class.immersive]="immersive()" [class.standalone]="standalone()" [class.fullscreen]="fullscreen()">
      @if (!hideSidenav() && !fullscreen()) {
        <app-sidenav />
      }
      <div class="main-wrapper">
        @if (!fullscreen()) {
          <app-header />
        }
        <main class="app-main" id="main-content" tabindex="-1">
          <router-outlet />
        </main>
        @if (!hideSidenav() && !fullscreen()) {
          <app-mobile-nav />
        }
      </div>
    </div>
    <app-toast-container />
    <app-notification-toast />
    @if (activeCallStore.minimized()) {
      <app-minimized-room-bar />
    }
    @if (pwaUpdate.shouldShowBanner()) {
      <app-pwa-update-banner />
    }
  `,
  styles: [
    `
      :host {
        display: block;
        /* Single source of truth for the content insets. Every page that
           mounts inside the shell consumes these via var() — no page
           re-derives app-header-height / bottom-nav-height / safe-area
           itself. The .app-shell.immersive ruleset (and the @media override
           below) flip these for the immersive-route case. */
        --shell-inset-top: var(--app-header-height);
        --shell-inset-bottom: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom));
      }

      .app-shell {
        display: grid;
        grid-template-columns: 1fr;
        height: 100svh;
        overflow: hidden;
      }
      @media (min-width: 1024px) {
        .app-shell {
          grid-template-columns: var(--sidebar-width) 1fr;
        }
        /* Standalone routes drop the sidebar at all viewports — collapse the
           grid to a single column so content fills the viewport. */
        .app-shell.standalone {
          grid-template-columns: 1fr;
        }
      }

      /* Fullscreen routes (login/signup — chromeless auth pages) drop every
         piece of shell chrome (sidenav, header, mobile-nav) on every
         viewport, not just mobile like .immersive does, and collapse the
         insets to zero so the page itself owns the full 100svh/100dvh and
         is responsible for its own safe-area padding. */
      .app-shell.fullscreen {
        grid-template-columns: 1fr;
        --shell-inset-top: 0px;
        --shell-inset-bottom: 0px;
      }

      .main-wrapper {
        display: block; /* hosts the absolutely-positioned header; pages render below */
        position: relative;
        min-height: 0;
        overflow: hidden;
      }

      /* The ONLY scroll container. Fills the slot — header floats above.
         Inset padding comes from --shell-inset-top / --shell-inset-bottom,
         which the :host above (and the .app-shell.immersive override below)
         compute based on whether the route hides the global chrome. */
      .app-main {
        height: 100%;
        min-height: 0;
        overflow-y: auto;
        overflow-x: hidden;
        overscroll-behavior-y: contain;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: thin;
        scrollbar-gutter: stable;
        scrollbar-color: var(--color-neutral-300) transparent;
        padding-top: var(--shell-inset-top);
        padding-bottom: var(--shell-inset-bottom);
      }
      .app-main::-webkit-scrollbar {
        width: 6px;
      }
      .app-main::-webkit-scrollbar-thumb {
        background-color: var(--color-neutral-300);
        border-radius: 3px;
      }

      /* Immersive routes (mobile room pages) hide the global header and bottom
         nav (see :host-context(.app-shell.immersive) in header/sidenav). The
         insets collapse to just the safe-area (mobile) or just the still-visible
         desktop app-header (desktop — sidenav replaces the bottom-nav on
         desktop, so the only chrome that disappears is the bottom-nav). */
      .app-shell.immersive {
        --shell-inset-top: max(env(safe-area-inset-top), var(--space-3));
        --shell-inset-bottom: env(safe-area-inset-bottom);
      }
      @media (min-width: 1024px) {
        .app-shell.immersive {
          --shell-inset-top: var(--app-header-height);
        }
      }
    `,
  ],
})
export class App {
  private readonly imBootstrap = inject(ImBootstrapService);
  private readonly router = inject(Router);
  readonly pwaUpdate = inject(PwaUpdateService);
  protected readonly activeCallStore = inject(ActiveCallStore);

  private readonly routeFlags = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => {
        const root = this.router.routerState.snapshot.root;
        return {
          immersive: isRouteFlagSet(root, 'immersive'),
          standalone: isRouteFlagSet(root, 'standalone'),
          fullscreen: isRouteFlagSet(root, 'fullscreen'),
        };
      }),
    ),
    { initialValue: { immersive: false, standalone: false, fullscreen: false } },
  );

  readonly immersive = computed(() => this.routeFlags().immersive);
  readonly standalone = computed(() => this.routeFlags().standalone);
  readonly fullscreen = computed(() => this.routeFlags().fullscreen);

  /**
   * CSS alone can hide the sidenav's content on mobile, but not remove
   * <app-sidenav> from the DOM (a @media query can't drive a template @if).
   * Immersive routes want it not rendered at all on mobile, so this tracks
   * viewport width directly — the one case in this shell where a
   * structural decision (mount or not) requires knowing the viewport, not
   * just the route.
   */
  private readonly isMobileViewport = injectIsMobileViewport();

  readonly hideSidenav = computed(() => this.immersive() && this.isMobileViewport());
}
