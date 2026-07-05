import { Component, ChangeDetectionStrategy, computed, input, output, signal } from '@angular/core';
import { LucideCornerUpLeft } from '@lucide/angular';

const SWIPE_THRESHOLD_PX = 60;
const SWIPE_SLOP_PX = 10;

@Component({
  selector: 'app-swipeable-bubble',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideCornerUpLeft],
  template: `
    <div
      class="message"
      [style.transform]="dragX() ? 'translateX(' + dragX() + 'px)' : null"
      [style.transition]="dragging() ? 'none' : null"
      (touchstart)="onTouchStart($event)"
      (touchmove)="onTouchMove($event)"
      (touchend)="onTouchEnd($event)"
      (touchcancel)="onTouchEnd($event)"
    >
      <ng-content />
      <span
        class="reply-affordance"
        [style.opacity]="affordanceOpacity()"
        aria-hidden="true"
      >
        <svg lucideCornerUpLeft [size]="14"></svg>
      </span>
    </div>
  `,
  styles: [`
    :host { display: contents; }

    .message {
      position: relative;
      touch-action: pan-y;
    }
    @media (prefers-reduced-motion: no-preference) {
      .message { transition: transform 0.18s ease-out; }
    }

    .reply-affordance {
      position: absolute;
      right: -36px;
      top: 50%;
      transform: translateY(-50%);
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--color-primary-500);
      color: var(--color-on-color);
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      transition: opacity 0.12s ease-out;
    }
    :host-context(.dark) .reply-affordance {
      background: var(--color-primary-600);
    }
  `],
})
export class SwipeableBubbleComponent {
  readonly commentId = input.required<string>();
  readonly reply = output<string>();

  readonly dragX = signal(0);
  readonly dragging = signal(false);

  protected readonly affordanceOpacity = computed(() => {
    const dx = -this.dragX();
    if (dx <= 0) return 0;
    return Math.min(1, dx / SWIPE_THRESHOLD_PX);
  });

  private touchStartX = 0;
  private touchStartY = 0;
  private didSwipe = false;

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
      this.reply.emit(this.commentId());
    }
    this.dragX.set(0);
  }
}
