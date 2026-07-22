import { Component, ChangeDetectionStrategy, inject, ViewEncapsulation } from '@angular/core';
import { ToastService, Toast, ToastAction } from '@core/services/toast.service';
import { LucideX, LucideCheckCircle, LucideAlertCircle, LucideAlertTriangle, LucideInfo } from '@lucide/angular';

/** Tailwind's built-in palette per toast type — bound as the --toast-accent CSS variable
 *  (still needed as a variable since several descendant rules share it: the accent stripe,
 *  icon-badge tint, primary action button, and progress bar all read the same color). */
const TOAST_ACCENT: Record<Toast['type'], string> = {
  success: '#10b981', // emerald-500
  error: '#ef4444', // red-500
  warning: '#f59e0b', // amber-500
  info: '#3b82f6', // blue-500
};

@Component({
  selector: 'app-toast-container',

  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [LucideX, LucideCheckCircle, LucideAlertCircle, LucideAlertTriangle, LucideInfo],
  template: `
    <div class="toast-container fixed z-[var(--z-toast)] flex flex-col gap-2.5 w-[calc(100%-2rem)] max-w-[360px] pointer-events-none left-1/2 -translate-x-1/2">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="toast relative flex items-center gap-3 pt-3 pr-4 pb-3.5 pl-[18px] rounded-xl overflow-hidden
                 bg-white dark:bg-neutral-900 shadow-xl border border-neutral-200 dark:border-neutral-700
                 pointer-events-auto
                 before:content-[''] before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:rounded-l-xl
                 animate-[toast-enter_280ms_cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none"
          [class.toast-leaving]="toast.leaving"
          [style.--toast-accent]="accentOf(toast.type)"
          role="alert"
          [attr.aria-live]="toast.type === 'error' ? 'assertive' : 'polite'"
          [attr.aria-atomic]="true"
        >
          <div
            class="toast-icon-badge shrink-0 flex items-center justify-center w-8 h-8 rounded-md"
            [style.color]="accentOf(toast.type)"
            aria-hidden="true"
          >
            @switch (toast.type) {
              @case ('success') {
                <svg lucideCheckCircle [size]="18"></svg>
              }
              @case ('error') {
                <svg lucideAlertCircle [size]="18"></svg>
              }
              @case ('warning') {
                <svg lucideAlertTriangle [size]="18"></svg>
              }
              @default {
                <svg lucideInfo [size]="18"></svg>
              }
            }
          </div>
          <div class="flex-1 min-w-0 flex flex-col gap-1.5">
            <span class="text-sm font-medium leading-normal text-neutral-900 dark:text-neutral-100">{{ toast.message }}</span>
            @if (toast.actions?.length) {
              <div class="flex gap-1.5">
                @for (action of toast.actions; track action.label) {
                  <button
                    type="button"
                    class="py-1 px-2.5 rounded-sm text-xs font-semibold cursor-pointer transition-colors duration-150"
                    [class]="action.variant === 'primary'
                      ? 'border-0 text-white'
                      : 'border border-neutral-200 dark:border-neutral-700 bg-transparent text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 hover:text-neutral-900 hover:border-neutral-300'"
                    [style.background-color]="action.variant === 'primary' ? accentOf(toast.type) : null"
                    (click)="onAction(toast, action)"
                  >
                    {{ action.label }}
                  </button>
                }
              </div>
            }
          </div>
          <button
            class="shrink-0 flex items-center justify-center w-11 h-11 rounded-sm border-0 bg-transparent
                   text-neutral-500 cursor-pointer [touch-action:manipulation] [-webkit-tap-highlight-color:transparent]
                   transition-colors duration-150
                   hover:bg-neutral-100 hover:text-neutral-900
                   focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            (click)="toastService.dismiss(toast.id)"
            aria-label="Dismiss notification"
          >
            <svg aria-hidden="true" lucideX [size]="14"></svg>
          </button>
          @if (toast.duration) {
            <div
              class="absolute left-0 right-0 bottom-0 h-[2.5px] opacity-50 origin-left"
              [style.background-color]="accentOf(toast.type)"
              [style.animation-duration.ms]="toast.duration"
              style="animation-name: toast-progress; animation-timing-function: linear; animation-fill-mode: forwards;"
            ></div>
          }
        </div>
      }
    </div>
  `,
  /**
   * Remaining structural CSS: top/left positioning uses --app-header-height (cross-component
   * layout contract) and --sidebar-width (desktop content-area centering, same reasoning as
   * app.ts's main-wrapper margin) - not color/branding. The three custom keyframes (enter,
   * exit, progress-bar countdown) are genuine motion design with no Tailwind built-in
   * equivalent, and the ::before accent stripe reads --toast-accent (functional per-instance
   * variable, not a design token — see TOAST_ACCENT above).
   */
  styles: [`
    .toast-container {
      top: calc(var(--app-header-height) + env(safe-area-inset-top, 0px) + 0.75rem);
    }
    @media (min-width: 1024px) {
      .toast-container { left: calc(50% + var(--sidebar-width) / 2); }
    }
    .toast::before { background: var(--toast-accent); }
    .toast-icon-badge { background-color: color-mix(in srgb, var(--toast-accent) 14%, white); }
    :host-context(.dark) .toast-icon-badge { background-color: color-mix(in srgb, var(--toast-accent) 20%, #171717); }
    .toast-leaving {
      animation: toast-exit 200ms ease-in forwards;
      pointer-events: none;
    }
    @keyframes toast-enter {
      from { opacity: 0; transform: translateY(-12px) scale(0.96); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes toast-exit {
      from { opacity: 1; transform: translateY(0) scale(1); }
      to { opacity: 0; transform: translateY(-8px) scale(0.96); }
    }
    @keyframes toast-progress {
      from { transform: scaleX(1); }
      to   { transform: scaleX(0); }
    }
  `]
})
export class ToastContainerComponent {
  readonly toastService = inject(ToastService);

  protected accentOf(type: Toast['type']): string {
    return TOAST_ACCENT[type];
  }

  onAction(toast: Toast, action: ToastAction): void {
    action.run();
    this.toastService.dismiss(toast.id);
  }
}
