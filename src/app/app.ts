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

function isRouteFlagSet(root: ActivatedRouteSnapshot, key: 'immersive' | 'fullscreen'): boolean {
  let node = root;
  while (node.firstChild) node = node.firstChild;
  return node.data[key] === true;
}

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, SidenavComponent, MobileNavComponent, HeaderComponent, ToastContainerComponent, PwaUpdateBannerComponent, MinimizedRoomBarComponent, NotificationToastComponent],
  template: `
    <div
      class="grid h-svh grid-cols-1 overflow-hidden"
      [class.immersive]="immersive()"
      [class.fullscreen]="fullscreen()"
      [style]="shellInsetsStyle()"
    >
      <!-- Sidenav's own mobile-folding logic lives inside app-sidenav.component.*;
           the shell only suppresses it on fullscreen routes (login/signup are
           chromeless) and immersive routes on mobile. -->
      <app-sidenav [hidden]="hideSidenav() || fullscreen()" />
      <div class="main-wrapper relative block min-h-0 overflow-hidden lg:ms-[var(--sidebar-width)] rtl:lg:ms-0 rtl:lg:me-[var(--sidebar-width)]">
        <app-header [hidden]="fullscreen()" [immersive]="hideSidenav()" />
        <main
          id="main-content"
          class="h-full min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain
                 pt-[var(--shell-inset-top)] pb-[var(--shell-inset-bottom)]
                 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]
                 [&::-webkit-scrollbar]:w-1.5
                 [&::-webkit-scrollbar-thumb]:bg-neutral-300 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-600
                 [&::-webkit-scrollbar-thumb]:rounded-[3px]"
          tabindex="-1"
        >
          <router-outlet />
        </main>
        <!-- Mobile-nav: hidden on lg+ (sidenav takes over), on fullscreen routes, and on
             immersive routes when the viewport is mobile (so rooms get the full viewport height).
             The third case used to be expressed as @media (max-width: 1023.98px) inside
             mobile-nav.component.ts — replaced by the [immersive] input below so the rule
             follows viewport state directly instead of a media-query dance. -->
        <app-mobile-nav
          class="block lg:hidden"
          [hidden]="fullscreen()"
          [immersive]="hideSidenav()" />
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
  /**
   * The only remaining non-utility CSS in this file: :host { display: block }. Angular's
   * default Emulated encapsulation has no way to put a class="" attribute on the host tag
   * from within its own template, so :host is the only mechanism available — not a
   * design-system/branding value, just how Angular host styling works.
   *
   * Everything else (structural layout, the scrollbar, touch-momentum scrolling, and the
   * --shell-inset-top/bottom padding) now lives in the template as Tailwind utility classes,
   * including arbitrary-value/arbitrary-variant forms:
   *   pt-[var(--shell-inset-top)] / pb-[var(--shell-inset-bottom)] — reads the CSS variable
   *     6 other files also consume; Tailwind can reference a var() as an arbitrary value even
   *     though it can't author one for cross-file consumption.
   *   [&::-webkit-scrollbar]:w-1.5, [&::-webkit-scrollbar-thumb]:bg-neutral-300 dark:[&::-
   *     webkit-scrollbar-thumb]:bg-neutral-600 — arbitrary pseudo-element variants replace
   *     the old plain-CSS ::-webkit-scrollbar-thumb rule (and add a dark-mode-aware color,
   *     which the original var(--color-neutral-300) reference did NOT have — that token has
   *     no dark override, so the old scrollbar thumb color didn't change between themes).
   */
  styles: [`:host { display: block; }`],
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
          fullscreen: isRouteFlagSet(root, 'fullscreen'),
        };
      }),
    ),
    { initialValue: { immersive: false, fullscreen: false } },
  );

  readonly immersive = computed(() => this.routeFlags().immersive);
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

  /**
   * Computes the per-state CSS variable overrides for --shell-inset-top / --shell-inset-bottom.
   * These variables are consumed by 6 other files via var(); Tailwind utility classes cannot
   * author CSS variables consumed across stylesheets, so the value must be expressed via
   * an inline [style] binding here. Replaces the previous SCSS .fullscreen / .immersive
   * rules AND the desktop @media (min-width: 1024px) override for bottom-nav clearance.
   *
   * Three states (fullscreen always wins):
   *   fullscreen   → both insets 0px (auth pages own their own safe-area padding)
   *   immersive    → top = max(safe-area-inset-top, --space-3)
   *                  bottom = safe-area-inset-bottom
   *                  (this is the immersive-mobile case; on desktop immersive just
   *                  hides the bottom-nav, so top stays the same as a normal page)
   *   normal       → top = app-header-height
   *                  bottom = bottom-nav-height + safe-area-inset-bottom (mobile)
   *                          or just safe-area-inset-bottom (lg+, since bottom-nav
   *                          is hidden via its own .lg:hidden)
   * The isMobileViewport signal decides which side of the lg+ branch we land on for
   * the normal state; immersive uses only the mobile shape.
   */
  readonly shellInsetsStyle = computed<Record<string, string>>(() => {
    const full = this.fullscreen();
    const imm = this.immersive();
    const mobile = this.isMobileViewport();

    if (full) {
      return {
        '--shell-inset-top': '0px',
        '--shell-inset-bottom': '0px',
      };
    }
    if (imm) {
      return {
        // 0.75rem matches Tailwind's default spacing scale step 3 (p-3/gap-3/etc.) —
        // used as a literal here instead of var(--space-3) since this project's
        // --space-* tokens are being phased out of the shell in favor of Tailwind's
        // own scale.
        '--shell-inset-top': 'max(env(safe-area-inset-top), 0.75rem)',
        '--shell-inset-bottom': 'env(safe-area-inset-bottom)',
      };
    }
    return {
      '--shell-inset-top': 'var(--app-header-height)',
      '--shell-inset-bottom': mobile
        ? 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px))'
        : 'env(safe-area-inset-bottom, 0px)',
    };
  });
}
