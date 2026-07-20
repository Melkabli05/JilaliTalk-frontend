import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideRadio, LucideVideo, LucideArrowRight } from '@lucide/angular';

@Component({
  selector: 'app-chat-room-share-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideRadio, LucideVideo, LucideArrowRight],
  template: `
    <button
      type="button"
      class="share-card"
      [class.is-outbound]="isOutbound()"
      (click)="join.emit()"
      [attr.aria-label]="fromName() + ' shared a ' + (kind() === 'voice' ? 'voice' : 'live') + ' room — tap to join'"
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
            Tap to join
          }
        </span>
      </span>
      <svg aria-hidden="true" class="share-chevron" lucideArrowRight [size]="16"></svg>
    </button>
  `,
  styles: [`
    :host { display: contents; }
    .share-card {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 12px; border-radius: 12px; border: 0;
      background: var(--color-neutral-100); color: var(--color-text);
      max-width: min(75%, 420px);
      box-shadow: var(--shadow-xs);
      cursor: pointer; text-align: start; font-family: inherit;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      animation: msgIn 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
      transition: background-color 150ms ease, transform 100ms ease;
    }
    .share-card:hover { background: var(--color-neutral-200); }
    .share-card:active { transform: scale(0.98); }
    .share-card:focus-visible { outline: var(--focus-ring); outline-offset: 2px; }
    .share-card.is-outbound { align-self: flex-end; background: var(--color-neutral-200); }
    .share-card.is-outbound:hover { background: var(--color-neutral-300); }
    :host-context([dir='rtl']) .share-card.is-outbound { align-self: flex-start; }
    :host-context(.dark) .share-card { background: var(--color-neutral-800); }
    :host-context(.dark) .share-card.is-outbound { background: var(--color-neutral-700); }
    :host-context(.dark) .share-card:hover { background: var(--color-neutral-700); }
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
    .share-chevron { flex-shrink: 0; color: var(--color-text-muted); }
    @keyframes msgIn {
      from { opacity: 0; transform: translateY(6px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @media (prefers-reduced-motion: reduce) {
      .share-card { animation: none; }
      .share-card:active { transform: none; }
    }
  `],
})
export class ChatRoomShareCardComponent {
  readonly cname = input.required<string>();
  readonly fromName = input.required<string>();
  readonly kind = input.required<'voice' | 'live'>();
  readonly listenerCount = input<number | null>(null);
  readonly isOutbound = input<boolean>(false);

  /** Emitted when the card is tapped/clicked. The chat page owns navigation to the room
   *  route (voice: /room/:cname/2, live: /room/video/:cname/1) — this component stays a
   *  dumb presentational card per this feature's ui/ convention and never injects Router. */
  readonly join = output<void>();
}