import { Component, ChangeDetectionStrategy, DestroyRef, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet, type ActivatedRouteSnapshot } from '@angular/router';
import { filter, map } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { SidenavComponent } from '@core/layout/sidenav.component';
import { HeaderComponent } from '@core/layout/header.component';
import { ImBootstrapService } from '@core/realtime/im-bootstrap.service';
import { ToastContainerComponent } from '@shared/ui/toast/toast-container.component';
import { PwaUpdateBannerComponent } from '@shared/ui';
import { PwaUpdateService } from '@core/services/pwa-update.service';

/** Walks to the deepest activated route and reports whether it opted into immersive mode. */
function isImmersiveRoute(root: ActivatedRouteSnapshot): boolean {
  let node = root;
  while (node.firstChild) node = node.firstChild;
  return node.data['immersive'] === true;
}

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, SidenavComponent, HeaderComponent, ToastContainerComponent, PwaUpdateBannerComponent],
  template: `
    <div class="app-shell" [class.immersive]="immersive()">
      @if (!hideSidenav()) {
        <app-sidenav />
      }
      <div class="main-wrapper">
        <app-header />
        <main class="app-main" id="main-content" tabindex="-1">
          <router-outlet />
        </main>
      </div>
    </div>
    <app-toast-container />
    @if (pwaUpdate.updateAvailable()) {
      <app-pwa-update-banner />
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .app-shell {
        display: grid;
        grid-template-columns: 1fr;
        /* Small viewport height — the guaranteed-visible area even with the
           browser's address/tab bars fully expanded. dvh recalculates as
           those bars animate, which can transiently exceed what's actually
           visible and make the page scroll; svh never does. */
        height: 100svh;
        overflow: hidden;
      }
      @media (min-width: 1024px) {
        .app-shell {
          grid-template-columns: var(--sidebar-width) 1fr;
        }
      }

      .main-wrapper {
        display: block; /* hosts the absolutely-positioned header; pages render below */
        position: relative;
        min-height: 0;
        overflow: hidden;
      }

      /* The ONLY scroll container. Fills the slot — header floats above. */
      .app-main {
        height: 100%;
        min-height: 0;
        overflow-y: auto;
        overflow-x: hidden;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: thin;
        scrollbar-gutter: stable;
        scrollbar-color: var(--color-neutral-300) transparent;
        /* Reserve space for the fixed global app-header so content doesn't render
           underneath it. The room page is the one exception — see the
           .app-shell.immersive override below — it manages its own header offset
           at every width (hidden header on mobile needs none; visible header on
           desktop reserves it itself), so it must not get this twice. */
        padding-top: var(--app-header-height);
        /* room for the fixed mobile bottom nav */
        padding-bottom: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom));
      }
      .app-main::-webkit-scrollbar {
        width: 6px;
      }
      .app-main::-webkit-scrollbar-thumb {
        background-color: var(--color-neutral-300);
        border-radius: 3px;
      }
      @media (min-width: 1024px) {
        .app-main {
          padding-bottom: 0;
        }
      }

      /* Immersive routes (mobile room pages) hide the global header and bottom nav —
         see :host-context(.app-shell.immersive) in header/sidenav components — so
         .app-main no longer needs to reserve space for either here. The room page's
         own :host (room-page.ts) manages its own header/safe-area offsets instead,
         at every width, so this override isn't limited to mobile. */
      .app-shell.immersive .app-main {
        padding-top: 0;
      }
      @media (max-width: 1023.98px) {
        .app-shell.immersive .app-main {
          padding-bottom: env(safe-area-inset-bottom);
        }
      }
    `,
  ],
})
export class App {
  private readonly imBootstrap = inject(ImBootstrapService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  readonly pwaUpdate = inject(PwaUpdateService);

  readonly immersive = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => isImmersiveRoute(this.router.routerState.snapshot.root)),
    ),
    { initialValue: false },
  );

  /**
   * CSS alone can hide the sidenav's content on mobile, but not remove
   * <app-sidenav> from the DOM (a @media query can't drive a template @if).
   * Immersive routes want it not rendered at all on mobile, so this tracks
   * viewport width directly — the one case in this shell where a
   * structural decision (mount or not) requires knowing the viewport, not
   * just the route.
   */
  private readonly isMobileViewport = signal(false);

  readonly hideSidenav = computed(() => this.immersive() && this.isMobileViewport());

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const mql = window.matchMedia('(max-width: 1023.98px)');
      const apply = () => this.isMobileViewport.set(mql.matches);
      apply();
      mql.addEventListener('change', apply);
      this.destroyRef.onDestroy(() => mql.removeEventListener('change', apply));
    }
  }
}
