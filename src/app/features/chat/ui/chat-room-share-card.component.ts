import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideRadio, LucideVideo, LucideEye, LucideEyeOff } from '@lucide/angular';
import { TooltipDirective } from '@shared/directives/tooltip.directive';

export type ShareCardJoinKind = 'visible' | 'invisible';

/**
 * Mirrors the visible/invisible join button pair on the real room-card
 * (features/rooms/ui/room-card/room-card.ts) — the same smali-driven shape used for
 * voice-room and live-room lists. The recipient gets a Join (visible) primary action
 * and a small ghost icon-button for invisible listen — same affordance as the standard
 * room-card, so the user gets a familiar interaction in any room-list context.
 *
 * This stays a dumb presentational card (CLAUDE.md §6): the chat page owns navigation
 * to the room route via {@link join} output, never injects Router.
 */
@Component({
  selector: 'app-chat-room-share-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TooltipDirective, LucideRadio, LucideVideo, LucideEye, LucideEyeOff],
  template: `
    <div
      class="share-card"
      [class.is-outbound]="isOutbound()"
      [attr.aria-label]="fromName() + ' shared a ' + (kind() === 'voice' ? 'voice' : 'live') + ' room'"
    >
      <span class="share-icon" [class.is-live]="kind() === 'live'">
        @if (kind() === 'voice') {
          <svg aria-hidden="true" lucideRadio [size]="18"></svg>
        } @else {
          <svg aria-hidden="true" lucideVideo [size]="18"></svg>
        }
      </span>
      <span class="share-body">
        <span class="share-label">
          {{ fromName() + ' shared a ' + (kind() === 'voice' ? 'voice' : 'live') + ' room' }}
        </span>
        <span class="share-detail">
          @if (kind() === 'voice' && listenerCount() != null) {
            {{ listenerCount() }} listening
          } @else {
            Tap a button to join
          }
        </span>
      </span>
      <div class="share-actions">
        <button
          type="button"
          class="action-btn action-btn--primary"
          (click)="joinVisible($event)"
          [attr.aria-label]="'Join ' + (kind() === 'voice' ? 'voice' : 'live') + ' room ' + cname()"
          [appTooltip]="'Join ' + (kind() === 'voice' ? 'voice' : 'live')"
          tooltipPosition="top"
        >
          <svg aria-hidden="true" lucideEye [size]="14"></svg>
          <span>Join</span>
        </button>
        <button
          type="button"
          class="action-btn action-btn--ghost"
          (click)="joinInvisible($event)"
          [attr.aria-label]="'Listen invisible to ' + (kind() === 'voice' ? 'voice' : 'live') + ' room ' + cname()"
          [appTooltip]="'Listen invisible'"
          tooltipPosition="top"
        >
          <svg aria-hidden="true" lucideEyeOff [size]="14"></svg>
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host { display: contents; }
    .share-card {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 12px; border-radius: 12px;
      background: var(--color-neutral-100); color: var(--color-text);
      max-width: min(75%, 460px);
      box-shadow: var(--shadow-xs);
      animation: msgIn 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
    }
    .share-card.is-outbound { align-self: flex-end; background: var(--color-neutral-200); }
    :host-context([dir='rtl']) .share-card.is-outbound { align-self: flex-start; }
    :host-context(.dark) .share-card { background: var(--color-neutral-800); }
    :host-context(.dark) .share-card.is-outbound { background: var(--color-neutral-700); }
    .share-icon {
      display: inline-flex; align-items: center; justify-content: center;
      width: 36px; height: 36px; flex-shrink: 0; border-radius: 50%;
      background: var(--color-primary-100); color: var(--color-primary-600);
    }
    .share-icon.is-live { background: var(--color-error-100); color: var(--color-error-600); }
    :host-context(.dark) .share-icon { background: var(--color-primary-800); color: var(--color-primary-200); }
    :host-context(.dark) .share-icon.is-live { background: var(--color-error-800); color: var(--color-error-200); }
    .share-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
    .share-label { font-size: var(--text-xs); font-weight: var(--font-semibold); }
    .share-detail { font-size: var(--text-sm); color: var(--color-text-muted); }
    .share-actions {
      display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0;
    }
    .action-btn {
      display: inline-flex; align-items: center; gap: 4px;
      min-height: 32px; padding: 0 10px;
      border-radius: var(--radius-md); border: 0; cursor: pointer;
      font-family: inherit; font-size: var(--text-xs); font-weight: var(--font-semibold);
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      transition: background-color 150ms ease, transform 100ms ease;
    }
    .action-btn:focus-visible { outline: var(--focus-ring); outline-offset: 2px; }
    .action-btn:active { transform: scale(0.96); }
    @media (max-width: 767.98px) {
      .action-btn { min-height: 40px; }
    }
    .action-btn--primary {
      background: var(--color-primary-500); color: var(--color-on-color);
      box-shadow: var(--shadow-primary-sm);
    }
    .action-btn--primary:hover { background: var(--color-primary-600); }
    :host-context(.dark) .action-btn--primary { background: var(--color-primary-600); }
    :host-context(.dark) .action-btn--primary:hover { background: var(--color-primary-500); }
    .action-btn--ghost {
      width: 32px; padding: 0;
      justify-content: center;
      background: transparent; color: var(--color-text-muted);
      border: 1px solid var(--color-border);
    }
    .action-btn--ghost:hover { background: var(--color-neutral-200); color: var(--color-text); }
    :host-context(.dark) .action-btn--ghost { border-color: var(--color-neutral-600); color: var(--color-neutral-400); }
    :host-context(.dark) .action-btn--ghost:hover { background: var(--color-neutral-700); color: var(--color-neutral-100); }
    @keyframes msgIn {
      from { opacity: 0; transform: translateY(6px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @media (prefers-reduced-motion: reduce) {
      .share-card { animation: none; }
      .action-btn:active { transform: none; }
    }
  `],
})
export class ChatRoomShareCardComponent {
  readonly cname = input.required<string>();
  readonly fromName = input.required<string>();
  readonly kind = input.required<'voice' | 'live'>();
  readonly listenerCount = input<number | null>(null);
  readonly isOutbound = input<boolean>(false);

  /**
   * Emitted when the user picks a join mode. The chat page owns navigation
   * (voice: /room/:cname/2, live: /room/video/:cname/1) and the join payload —
   * this card stays presentational per the feature's ui/ convention.
   */
  readonly join = output<ShareCardJoinKind>();

  protected joinVisible(event: Event): void {
    event.stopPropagation();
    this.join.emit('visible');
  }

  protected joinInvisible(event: Event): void {
    event.stopPropagation();
    this.join.emit('invisible');
  }
}
