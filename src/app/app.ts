import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidenavComponent } from '@core/layout/sidenav.component';
import { HeaderComponent } from '@core/layout/header.component';
import { ImBootstrapService } from '@core/realtime/im-bootstrap.service';
import { ToastContainerComponent } from '@shared/ui/toast/toast-container.component';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, SidenavComponent, HeaderComponent, ToastContainerComponent],
  template: `
    <div class="app-shell">
      <app-sidenav />
      <div class="main-wrapper">
        <app-header />
        <main class="app-main" id="main-content" tabindex="-1">
          <router-outlet />
        </main>
      </div>
    </div>
    <app-toast-container />
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
        display: flex;
        flex-direction: column;
        min-height: 0; /* critical: lets the flex child shrink so its child can scroll */
        overflow: hidden;
      }

      /* The ONLY scroll container. */
      .app-main {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        overflow-x: hidden;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: thin;
        scrollbar-color: var(--color-neutral-300) transparent;
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
    `,
  ],
})
export class App {
  private readonly imBootstrap = inject(ImBootstrapService);
}
