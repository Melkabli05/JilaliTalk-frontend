import { Component, ChangeDetectionStrategy, DestroyRef, ElementRef, PLATFORM_ID, computed, effect, inject, signal, viewChild } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Dialog } from '@angular/cdk/dialog';
import { LucideBell, LucideCheck, LucideTrash2 } from '@lucide/angular';
import { NotificationStore } from '@store/notification.store';
import { UserInfoService } from '@core/services/user-info.service';
import { UserInfoModalComponent, UserInfoModalData } from '@shared/ui/user-info-modal';
import { NotificationFilterTabsComponent } from './notification-filter-tabs.component';
import { NotificationDayGroupComponent } from './notification-day-group.component';
import type { AppNotification } from './notification.model';

const SHEET_CLOSE_THRESHOLD_PX = 80;
const MOBILE_BREAKPOINT_QUERY = '(max-width: 768px)';

@Component({
  selector: 'app-notification-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'store.close()',
  },
  imports: [LucideBell, LucideCheck, LucideTrash2, NotificationFilterTabsComponent, NotificationDayGroupComponent],
  template: `
    @if (store.isOpen()) {
      <div class="notification-overlay" (click)="onOverlayClick()" role="presentation"></div>
      <div
        #panelRoot
        class="notification-panel"
        [class.sheet]="isMobile()"
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
            class="sheet-handle"
            aria-hidden="true"
            (touchstart)="onSheetTouchStart($event)"
            (touchmove)="onSheetTouchMove($event)"
            (touchend)="onSheetTouchEnd($event)"
          ></div>
        }
        <header class="panel-header">
          <div class="header-title">
            <svg aria-hidden="true" lucideBell [size]="16" class="header-icon"></svg>
            <span class="header-text">Notifications</span>
            @if (store.unreadCount() > 0) {
              <span class="unread-badge" aria-label="{{ store.unreadCount() }} unread">
                {{ store.unreadCount() }}
              </span>
            }
          </div>
          <div class="header-actions">
            @if (store.unreadCount() > 0) {
              <button type="button" class="action-btn" (click)="store.markAllRead()" aria-label="Mark all notifications as read">
                <svg aria-hidden="true" lucideCheck [size]="14" class="action-icon"></svg>
                <span class="action-text">Mark all read</span>
              </button>
            }
            @if (store.hasNotifications()) {
              <button type="button" class="action-btn danger" (click)="store.clear()" aria-label="Clear all notifications">
                <svg aria-hidden="true" lucideTrash2 [size]="14" class="action-icon"></svg>
                <span class="action-text">Clear all</span>
              </button>
            }
          </div>
        </header>

        <app-notification-filter-tabs
          [active]="store.filter()"
          [counts]="store.filterCounts()"
          (filterChange)="store.setFilter($event)"
        />

        <main id="notification-list" class="panel-content" role="list" aria-label="Notification list" aria-live="polite" aria-atomic="false">
          @if (store.groupedItems().length === 0) {
            <div class="empty-state" role="status">
              <svg aria-hidden="true" lucideBell [size]="32" class="empty-icon"></svg>
              <p class="empty-title">{{ emptyTitle() }}</p>
              <p class="empty-description">We'll notify you when something happens</p>
            </div>
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
  styles: [`
    .notification-overlay { position: fixed; inset: 0; z-index: 39; background: transparent; }

    .notification-panel {
      position: fixed;
      top: 60px;
      right: var(--space-4);
      z-index: 40;
      width: 380px;
      max-height: 520px;
      background: var(--color-card);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-elevation-3);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      overscroll-behavior: contain;
      animation: slideIn 0.2s ease-out;
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .notification-panel.sheet {
      top: auto;
      bottom: 0;
      left: 0;
      right: 0;
      width: 100%;
      max-height: 70dvh;
      border-radius: var(--radius-2xl) var(--radius-2xl) 0 0;
      padding-bottom: env(safe-area-inset-bottom);
      animation: sheetIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes sheetIn {
      from { opacity: 0; transform: translateY(24px); }
      to { opacity: 1; transform: translateY(0); }
    }
    /* Drag-to-close only engages on this handle (not the whole sheet), so the
       scrollable list below and the horizontally-scrolling filter tabs are
       never fought over by the two gestures. */
    .sheet-handle {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: var(--space-6);
      margin-top: calc(var(--space-2) * -1);
      flex-shrink: 0;
      touch-action: none;
    }
    .sheet-handle::after {
      content: '';
      width: 40px;
      height: 4px;
      border-radius: 2px;
      background: var(--color-neutral-300);
    }
    :host-context(.dark) .sheet-handle::after { background: var(--color-neutral-600); }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-3) var(--space-4);
      border-bottom: 1px solid var(--color-border);
      gap: var(--space-2);
    }
    .header-title { display: flex; align-items: center; gap: var(--space-2); }
    .header-icon { color: var(--color-text-secondary); }
    .header-text { font-size: var(--text-sm); font-weight: var(--font-semibold); color: var(--color-text); }
    .unread-badge {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 20px; height: 20px; padding: 0 6px;
      border-radius: var(--radius-full); background: var(--color-warm-500); color: var(--color-on-color);
      font-size: 11px; font-weight: var(--font-bold); line-height: 1;
    }
    .header-actions { display: flex; align-items: center; gap: var(--space-1); }
    .action-btn {
      display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px;
      border-radius: var(--radius-md); font-size: var(--text-xs); font-weight: var(--font-medium);
      color: var(--color-text-secondary); background: transparent; border: none; cursor: pointer;
      transition: background-color 0.15s ease, color 0.15s ease;
    }
    .action-btn:hover { background: var(--color-neutral-100); color: var(--color-text); }
    .action-btn:focus-visible { outline: var(--focus-ring); outline-offset: 2px; }
    .action-btn.danger:hover { background: color-mix(in srgb, var(--color-warm-500) 10%, transparent); color: var(--color-warm-600); }
    :host-context(.dark) .action-btn:hover { background: var(--color-neutral-700); }
    :host-context(.dark) .action-btn.danger:hover { background: color-mix(in srgb, var(--color-warm-500) 15%, transparent); color: var(--color-warm-400); }
    .action-icon { flex-shrink: 0; }

    .panel-content { flex: 1; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; padding: var(--space-2); }
    .panel-content::-webkit-scrollbar { width: 6px; }
    .panel-content::-webkit-scrollbar-track { background: transparent; }
    .panel-content::-webkit-scrollbar-thumb { background: var(--color-neutral-300); border-radius: 3px; }
    :host-context(.dark) .panel-content::-webkit-scrollbar-thumb { background: var(--color-neutral-600); }

    .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--space-10) var(--space-4); text-align: center; }
    .empty-icon { color: var(--color-text-tertiary); opacity: 0.5; margin-bottom: var(--space-3); }
    .empty-title { font-size: var(--text-sm); font-weight: var(--font-medium); color: var(--color-text-secondary); margin: 0 0 var(--space-1); }
    .empty-description { font-size: var(--text-xs); color: var(--color-text-tertiary); margin: 0; }
  `],
})
export class NotificationPanelComponent {
  readonly store = inject(NotificationStore);
  private readonly dialog = inject(Dialog);
  private readonly userInfo = inject(UserInfoService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _isMobile = signal(false);
  readonly isMobile = this._isMobile.asReadonly();

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

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const mql = window.matchMedia(MOBILE_BREAKPOINT_QUERY);
      const apply = () => this._isMobile.set(mql.matches);
      apply();
      mql.addEventListener('change', apply);
      this.destroyRef.onDestroy(() => mql.removeEventListener('change', apply));
    }

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
  }

  onOverlayClick(): void {
    this.store.close();
  }

  onItemOpen(notification: AppNotification): void {
    if (!notification.userId) return;
    void this.userInfo.fetchUserInfo(notification.userId);
    this.dialog.open<UserInfoModalComponent, UserInfoModalData>(UserInfoModalComponent, {
      data: {
        userId: notification.userId,
        nickname: notification.nickname ?? null,
        headUrl: notification.avatarUrl ?? null,
      },
      backdropClass: 'app-modal-backdrop',
      ariaLabelledBy: 'user-info-title',
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
