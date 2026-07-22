import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { NotificationStore } from '@store/notification.store';
import { LucideCheckCircle, LucideAlertCircle, LucideAlertTriangle, LucideInfo } from '@lucide/angular';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';

@Component({
  selector: 'app-notification-toast',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideCheckCircle, LucideAlertCircle, LucideAlertTriangle, LucideInfo, AvatarComponent],
  template: `
    @if (store.pendingToast(); as n) {
      <button
        type="button"
        class="notification-toast fixed z-[var(--z-toast)] flex items-start gap-2 max-w-80 p-3 rounded-lg
               bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700
               shadow-xl cursor-pointer [touch-action:manipulation] [-webkit-tap-highlight-color:transparent]
               text-left min-h-11 animate-[toast-preview-enter_0.2s_ease-out] motion-reduce:animate-none
               focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500
               rtl:right-auto rtl:left-[max(1rem,env(safe-area-inset-left,0px))]"
        (click)="store.dismissToast()"
        aria-live="polite"
      >
        @if (n.avatarUrl) {
          <app-avatar
            [src]="n.avatarUrl"
            [alt]="n.nickname ?? 'User'"
            [initials]="n.nickname ? n.nickname.slice(0, 2) : null"
            size="sm"
            shape="circle"
            class="shrink-0 self-start"
          />
        } @else {
          <span class="shrink-0 mt-px" aria-hidden="true">
            @switch (n.type) {
              @case ('success') { <svg lucideCheckCircle [size]="16" class="text-emerald-500"></svg> }
              @case ('error') { <svg lucideAlertCircle [size]="16" class="text-red-500"></svg> }
              @case ('warning') { <svg lucideAlertTriangle [size]="16" class="text-amber-500"></svg> }
              @default { <svg lucideInfo [size]="16" class="text-blue-500"></svg> }
            }
          </span>
        }
        <span class="flex flex-col gap-0.5 min-w-0">
          <span class="text-sm font-medium text-neutral-900 dark:text-neutral-100">{{ n.title }}</span>
          @if (n.message) {
            <span class="text-xs text-neutral-600 dark:text-neutral-300">{{ n.message }}</span>
          }
        </span>
      </button>
    }
  `,
  /** Remaining structural CSS: position/top uses --app-header-height (cross-component
   *  layout contract), z-index uses --z-toast (shared stacking-order coordination). The
   *  custom slide-in keyframe is genuine motion design, no Tailwind built-in equivalent. */
  styles: [`
    .notification-toast {
      top: calc(var(--app-header-height) + env(safe-area-inset-top, 0px) + 0.75rem);
      right: max(1rem, env(safe-area-inset-right, 0px));
    }
    @keyframes toast-preview-enter {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `],
})
export class NotificationToastComponent {
  protected readonly store = inject(NotificationStore);
}
