import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { PwaUpdateService } from '@core/services/pwa-update.service';
import { LucideRefreshCw } from '@lucide/angular';

@Component({
  selector: 'app-pwa-update-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideRefreshCw],
  host: { class: 'contents' },
  template: `
    <div
      class="update-toast fixed z-[var(--z-toast)] flex items-center gap-3
             w-[calc(100%-2rem)] max-w-[380px] px-3.5 py-3 rounded-xl
             bg-white dark:bg-neutral-900 shadow-xl border border-neutral-200 dark:border-neutral-700
             animate-[update-toast-enter_280ms_cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none
             left-1/2"
      role="status"
      aria-live="polite"
    >
      <div class="shrink-0 flex items-center justify-center w-8 h-8 rounded-md bg-blue-500/14 text-blue-600 dark:text-blue-400" aria-hidden="true">
        <svg lucideRefreshCw [size]="18"></svg>
      </div>

      <div class="flex-1 min-w-0 flex flex-col gap-1.5">
        <span class="text-sm font-medium leading-normal text-neutral-900 dark:text-neutral-100">
          A new version of JilaliTalk is available.
        </span>

        <button
          type="button"
          class="self-start px-2.5 py-1 rounded-sm border-0 bg-blue-600 text-white text-xs font-semibold cursor-pointer
                 transition-[filter] duration-150 hover:brightness-90
                 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          (click)="activate()"
        >
          Reload to update
        </button>
      </div>
    </div>
  `,
  /**
   * Remaining structural CSS: top offset uses --app-header-height (cross-component layout
   * contract), z-index uses --z-toast (shared stacking-order coordination), and the
   * translate-X centering must account for --sidebar-width on desktop (the banner should
   * center over the content area, not the full viewport, once the sidebar takes space) -
   * this is the same structural coordination app.ts's main-wrapper margin depends on, not
   * a design-system/color choice. The enter keyframe is genuine motion design.
   */
  styles: `
    .update-toast {
      top: calc(var(--app-header-height) + env(safe-area-inset-top, 0px) + 0.75rem);
      transform: translateX(var(--update-toast-translate, -50%));
    }
    @media (min-width: 1024px) {
      .update-toast {
        --update-toast-translate: calc(-50% + var(--sidebar-width) / 2);
      }
    }
    @keyframes update-toast-enter {
      from {
        opacity: 0;
        transform: translateX(var(--update-toast-translate, -50%))
          translateY(-12px) scale(0.96);
      }
      to {
        opacity: 1;
        transform: translateX(var(--update-toast-translate, -50%))
          translateY(0) scale(1);
      }
    }
  `,
})
export class PwaUpdateBannerComponent {
  readonly pwaUpdate = inject(PwaUpdateService);

  async activate(): Promise<void> {
    await this.pwaUpdate.activateUpdate();
  }
}
