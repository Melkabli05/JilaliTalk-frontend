import { Component, ChangeDetectionStrategy, input, output, signal, computed } from '@angular/core';
import { LucideX } from '@lucide/angular';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { relativeTime } from '@shared/utils/relative-time.util';
import type { AppNotification } from './notification.model';

const SWIPE_THRESHOLD_PX = 72;
const SWIPE_SLOP_PX = 10;

const INDICATOR_COLOR: Record<string, string> = {
  info: 'bg-blue-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
};

@Component({
  selector: 'app-notification-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideX, AvatarComponent],
  template: `
    <article
      class="group flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors duration-150 relative [touch-action:pan-y]
             hover:bg-neutral-50 dark:hover:bg-neutral-800
             focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500"
      [class]="!notification().read ? 'bg-blue-500/6 hover:bg-blue-500/10 dark:bg-blue-500/12 dark:hover:bg-blue-500/18' : ''"
      [attr.data-type]="notification().type"
      role="listitem"
      tabindex="0"
      [style.transform]="dragX() ? 'translateX(' + dragX() + 'px)' : null"
      [style.transition]="dragging() ? 'none' : null"
      (touchstart)="onTouchStart($event)"
      (touchmove)="onTouchMove($event)"
      (touchend)="onTouchEnd($event)"
      (click)="onOpen()"
      (keydown.enter)="onOpen()"
      (keydown.space)="onOpen(); $event.preventDefault()"
    >
      @if (notification().userId) {
        <app-avatar
          [src]="notification().avatarUrl ?? ''"
          [alt]="notification().nickname ?? 'User'"
          [initials]="notification().nickname ? notification().nickname!.slice(0, 2) : null"
          size="sm"
          shape="circle"
          class="shrink-0 self-start mt-0.5"
        />
      } @else {
        <div class="w-2 h-2 rounded-full shrink-0 mt-1.5" [class]="indicatorClass()" aria-hidden="true"></div>
      }
      <div class="flex-1 min-w-0">
        <p
          class="text-sm text-neutral-900 dark:text-neutral-100 m-0 leading-snug"
          [class]="!notification().read ? 'font-semibold' : 'font-medium'"
        >{{ notification().title }}</p>
        @if (notification().message) {
          <p class="text-xs text-neutral-600 dark:text-neutral-300 mt-0.5 mb-0 leading-normal">{{ notification().message }}</p>
        }
        <time class="block text-[11px] text-neutral-400 mt-1" [attr.datetime]="isoTimestamp(notification().timestamp)">
          {{ relativeTime(notification().timestamp) }}
        </time>
      </div>
      <button
        type="button"
        class="inline-flex items-center justify-center w-6 h-6 rounded-md bg-transparent border-0 cursor-pointer
               text-neutral-400 opacity-0 shrink-0
               transition-[opacity,background-color,color] duration-150
               group-hover:opacity-100
               hover:bg-neutral-200 hover:text-neutral-600
               dark:hover:bg-neutral-600"
        (click)="onRemoveClick($event)"
        [attr.aria-label]="'Remove notification: ' + notification().title"
      >
        <svg aria-hidden="true" lucideX [size]="12"></svg>
      </button>
    </article>
  `,
})
export class NotificationItemComponent {
  readonly notification = input.required<AppNotification>();
  readonly remove = output<string>();
  readonly open = output<AppNotification>();

  readonly relativeTime = relativeTime;
  readonly dragX = signal(0);
  readonly dragging = signal(false);

  readonly indicatorClass = computed(() => INDICATOR_COLOR[this.notification().type] ?? INDICATOR_COLOR['info']);

  private touchStartX = 0;
  private touchStartY = 0;
  private didSwipe = false;

  isoTimestamp(ts: number): string {
    return new Date(ts).toISOString();
  }

  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.touches[0]!.clientX;
    this.touchStartY = event.touches[0]!.clientY;
    this.didSwipe = false;
    this.dragging.set(true);
  }

  onTouchMove(event: TouchEvent): void {
    if (!this.dragging()) return;
    const deltaX = event.touches[0]!.clientX - this.touchStartX;
    const deltaY = event.touches[0]!.clientY - this.touchStartY;
    if (Math.abs(deltaY) > Math.abs(deltaX)) return;
    if (Math.abs(deltaX) > SWIPE_SLOP_PX) this.didSwipe = true;
    if (deltaX < 0) this.dragX.set(deltaX);
  }

  onTouchEnd(event: TouchEvent): void {
    if (!this.dragging()) return;
    this.dragging.set(false);
    const deltaX = event.changedTouches[0]!.clientX - this.touchStartX;
    if (deltaX < -SWIPE_THRESHOLD_PX) {
      this.remove.emit(this.notification().id);
    } else {
      this.dragX.set(0);
    }
  }

  onOpen(): void {
    if (this.didSwipe) {
      this.didSwipe = false;
      return;
    }
    this.open.emit(this.notification());
  }

  onRemoveClick(event: MouseEvent): void {
    event.stopPropagation();
    this.remove.emit(this.notification().id);
  }
}
