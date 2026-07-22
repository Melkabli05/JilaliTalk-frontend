import { Component, ChangeDetectionStrategy, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { Router } from '@angular/router';
import { LucideBell, LucideCheck, LucideTrash2 } from '@lucide/angular';
import { NotificationStore } from '@store/notification.store';
import { UserInfoService } from '@core/services/user-info.service';
import { UserInfoModalComponent, UserInfoModalData } from '@shared/ui/user-info-modal';
import { injectIsMobileViewport } from '@shared/utils';
import { NotificationFilterTabsComponent } from './notification-filter-tabs.component';
import { NotificationDayGroupComponent } from './notification-day-group.component';
import { EmptyStateComponent } from '@shared/ui/empty-state/empty-state.component';
import type { AppNotification } from './notification.model';

const SHEET_CLOSE_THRESHOLD_PX = 80;
/** Deliberately narrower than the shell's 1024px mobile breakpoint — the panel
 *  only switches to a bottom-sheet layout at phone width, not tablet width. */
const SHEET_BREAKPOINT_QUERY = '(max-width: 768px)';

@Component({
  selector: 'app-notification-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'store.close()',
  },
  imports: [LucideBell, LucideCheck, LucideTrash2, NotificationFilterTabsComponent, NotificationDayGroupComponent, EmptyStateComponent],
  template: `
    @if (store.isOpen()) {
      <div [class]="overlayClass()" (click)="onOverlayClick()" role="presentation"></div>
      <div
        #panelRoot
        [class]="panelClass()"
        role="dialog"
        aria-modal="true"
        aria-label="Notifications"
        aria-describedby="notification-list"
        tabindex="-1"
        [style.transform]="dragY() ? 'translateY(' + dragY() + 'px)' : null"
        [style.transition]="dragging() ? 'none' : null"
      >
        @if (isMobile()) {
          <div
            class="sheet-handle flex items-center justify-center w-full h-6 -mt-2 shrink-0 [touch-action:none]
                   after:content-[''] after:w-10 after:h-1 after:rounded-sm after:bg-neutral-300 dark:after:bg-neutral-600"
            aria-hidden="true"
            (touchstart)="onSheetTouchStart($event)"
            (touchmove)="onSheetTouchMove($event)"
            (touchend)="onSheetTouchEnd($event)"
          ></div>
        }
        <header class="flex items-center justify-between gap-2 py-3 px-4 border-b border-neutral-200 dark:border-neutral-700">
          <div class="flex items-center gap-2">
            <svg aria-hidden="true" lucideBell [size]="16" class="text-neutral-600 dark:text-neutral-300"></svg>
            <span class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Notifications</span>
            @if (store.unreadCount() > 0) {
              <span
                class="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold leading-none"
                aria-label="{{ store.unreadCount() }} unread"
              >
                {{ store.unreadCount() }}
              </span>
            }
          </div>
          <div class="flex items-center gap-1">
            @if (store.unreadCount() > 0) {
              <button
                type="button"
                class="inline-flex items-center gap-1 py-1.5 px-2.5 rounded-md text-xs font-medium
                       text-neutral-600 dark:text-neutral-300 bg-transparent border-0 cursor-pointer
                       transition-colors duration-150
                       hover:bg-neutral-100 hover:text-neutral-900
                       dark:hover:bg-neutral-700 dark:hover:text-neutral-100
                       focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                (click)="store.markAllRead()"
                aria-label="Mark all notifications as read"
              >
                <svg aria-hidden="true" lucideCheck [size]="14" class="shrink-0"></svg>
                <span>Mark all read</span>
              </button>
            }
            @if (store.hasNotifications()) {
              <button
                type="button"
                class="inline-flex items-center gap-1 py-1.5 px-2.5 rounded-md text-xs font-medium
                       text-neutral-600 dark:text-neutral-300 bg-transparent border-0 cursor-pointer
                       transition-colors duration-150
                       hover:bg-red-500/10 hover:text-red-600
                       dark:hover:bg-red-500/15 dark:hover:text-red-400
                       focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                (click)="store.clear()"
                aria-label="Clear all notifications"
              >
                <svg aria-hidden="true" lucideTrash2 [size]="14" class="shrink-0"></svg>
                <span>Clear all</span>
              </button>
            }
          </div>
        </header>

        <app-notification-filter-tabs
          [active]="store.filter()"
          [counts]="store.filterCounts()"
          (filterChange)="store.setFilter($event)"
        />

        <main
          id="notification-list"
          class="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-2
                 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent
                 [&::-webkit-scrollbar-thumb]:bg-neutral-300 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-600
                 [&::-webkit-scrollbar-thumb]:rounded-sm"
          role="list"
          aria-label="Notification list"
          aria-live="polite"
          aria-atomic="false"
        >
          @if (store.groupedItems().length === 0) {
            <app-empty-state role="status" [title]="emptyTitle()" body="We'll notify you when something happens" [iconSize]="32">
              <svg empty-state-icon aria-hidden="true" lucideBell [size]="32"></svg>
            </app-empty-state>
          } @else {
            @for (group of store.groupedItems(); track group.bucket) {
              <app-notification-day-group
                [label]="group.label"
                [items]="group.items"
                (remove)="onItemRemove($event)"
                (open)="onItemOpen($event)"
              />
            }
          }
        </main>
      </div>
    }
  `,
  /**
   * Remaining structural/motion CSS: z-index vars (--z-notification-backdrop/-panel, shared
   * stacking coordination), --app-header-height (cross-component layout contract), and the
   * genuine entrance keyframes (no Tailwind built-in for this fade/slide-in shape).
   */
  styles: [`
    .notification-overlay { z-index: var(--z-notification-backdrop); }
    .notification-panel { top: var(--app-header-height); z-index: var(--z-notification-panel); }
    @keyframes sheetFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideIn {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes sheetIn {
      from { opacity: 0; transform: translateY(24px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `],
})
export class NotificationPanelComponent {
  readonly store = inject(NotificationStore);
  private readonly dialog = inject(Dialog);
  private readonly userInfo = inject(UserInfoService);
  private readonly router = inject(Router);

  readonly isMobile = injectIsMobileViewport(SHEET_BREAKPOINT_QUERY);

  readonly dragY = signal(0);
  readonly dragging = signal(false);
  private sheetTouchStartY = 0;

  private previouslyFocused: HTMLElement | null = null;
  private readonly panelRootRef = viewChild<ElementRef<HTMLElement>>('panelRoot');

  readonly emptyTitle = computed(() => {
    const filter = this.store.filter();
    if (filter === 'all') return 'No notifications yet';
    if (filter === 'unread') return 'No unread notifications';
    return `No ${filter} notifications`;
  });

  /** Mobile only: tint and blur the page behind the sheet so it visibly recedes and reads
   *  as a modal layer. Desktop panel uses a transparent overlay because a full-screen blur
   *  behind a 380px dropdown looks heavy. */
  protected readonly overlayClass = computed(() =>
    this.isMobile()
      ? 'notification-overlay fixed inset-0 bg-neutral-500/35 backdrop-blur-[8px] backdrop-saturate-[140%] animate-[sheetFadeIn_0.2s_ease-out] motion-reduce:animate-none'
      : 'notification-overlay fixed inset-0 bg-transparent',
  );

  protected readonly panelClass = computed(() => {
    const base =
      'notification-panel fixed flex flex-col overflow-hidden overscroll-contain ' +
      'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 shadow-2xl ' +
      'rtl:right-auto rtl:left-4';
    if (this.isMobile()) {
      return `${base} inset-x-0 bottom-0 w-full max-h-[70dvh] rounded-t-2xl pb-[env(safe-area-inset-bottom)] animate-[sheetIn_0.25s_cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:animate-none`;
    }
    return `${base} right-4 w-[380px] max-h-[520px] rounded-xl animate-[slideIn_0.2s_ease-out] motion-reduce:animate-none`;
  });

  constructor() {
    effect(() => {
      if (this.store.isOpen()) {
        this.store.markAllRead();
        this.previouslyFocused = document.activeElement as HTMLElement | null;
        queueMicrotask(() => this.panelRootRef()?.nativeElement.focus());
      } else if (this.previouslyFocused) {
        this.previouslyFocused.focus();
        this.previouslyFocused = null;
      }
    });

    // Soft body-scroll lock while the bottom sheet is open on mobile: stops the page
    // underneath from scrolling when the user over-scrolls the notification list (iOS
    // Safari rubber-band otherwise pulls the page). Desktop panel intentionally doesn't
    // lock — it's a small dropdown over the header, the existing UX is fine.
    effect(() => {
      if (!this.isMobile()) return;
      if (this.store.isOpen()) {
        document.body.style.overflow = 'hidden';
        return () => {
          document.body.style.overflow = '';
        };
      }
      return;
    });
  }

  onOverlayClick(): void {
    this.store.close();
  }

  onItemOpen(notification: AppNotification): void {
    if (notification.action?.type === 'navigate_to_conversation') {
      this.router.navigate(['/messages', notification.action.userId]);
      this.store.close();
      return;
    }
    if (notification.action?.type === 'open_user_profile') {
      void this.userInfo.fetchUserInfo(notification.action.userId);
      this.dialog.open<UserInfoModalComponent, UserInfoModalData>(UserInfoModalComponent, {
        data: {
          userId: notification.action.userId,
          nickname: notification.nickname ?? null,
          headUrl: notification.avatarUrl ?? null,
        },
        backdropClass: 'app-modal-backdrop',
        ariaLabel: notification.nickname ?? 'User',
      });
      return;
    }
    if (!notification.userId) return;
    void this.userInfo.fetchUserInfo(notification.userId);
    this.dialog.open<UserInfoModalComponent, UserInfoModalData>(UserInfoModalComponent, {
      data: {
        userId: notification.userId,
        nickname: notification.nickname ?? null,
        headUrl: notification.avatarUrl ?? null,
      },
      backdropClass: 'app-modal-backdrop',
      ariaLabel: notification.nickname ?? 'User',
    });
  }

  onItemRemove(id: string): void {
    this.store.requestRemove(id);
  }

  onSheetTouchStart(event: TouchEvent): void {
    if (!this.isMobile()) return;
    this.sheetTouchStartY = event.touches[0]!.clientY;
    this.dragging.set(true);
  }

  onSheetTouchMove(event: TouchEvent): void {
    if (!this.dragging()) return;
    const delta = event.touches[0]!.clientY - this.sheetTouchStartY;
    if (delta > 0) this.dragY.set(delta);
  }

  onSheetTouchEnd(event: TouchEvent): void {
    if (!this.dragging()) return;
    this.dragging.set(false);
    const delta = event.changedTouches[0]!.clientY - this.sheetTouchStartY;
    this.dragY.set(0);
    if (delta > SHEET_CLOSE_THRESHOLD_PX) this.store.close();
  }
}
