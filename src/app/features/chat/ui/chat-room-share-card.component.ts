import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-chat-room-share-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="share-card" [class.is-outbound]="isOutbound()" role="note">
      <span class="share-label">
        {{ fromName() + ' shared a ' + (kind() === 'voice' ? 'voice' : 'live') + ' room' }}
      </span>
      <span class="share-detail">
        @if (kind() === 'voice' && listenerCount() != null) {
          {{ listenerCount() }} listening
        } @else {
          {{ cname() }}
        }
      </span>
    </div>
  `,
  styles: [`
    :host { display: contents; }
    .share-card {
      display: flex; flex-direction: column; gap: 4px;
      padding: 10px 12px; border-radius: 12px;
      background: var(--color-neutral-100); color: var(--color-text);
      max-width: min(75%, 420px);
      box-shadow: var(--shadow-xs);
      animation: msgIn 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
    }
    .share-card.is-outbound { align-self: flex-end; background: var(--color-neutral-200); }
    :host-context([dir='rtl']) .share-card.is-outbound { align-self: flex-start; }
    :host-context(.dark) .share-card { background: var(--color-neutral-800); }
    :host-context(.dark) .share-card.is-outbound { background: var(--color-neutral-700); }
    .share-label { font-size: var(--text-xs); font-weight: var(--font-semibold); }
    .share-detail { font-size: var(--text-sm); color: var(--color-text-muted); }
    @keyframes msgIn {
      from { opacity: 0; transform: translateY(6px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @media (prefers-reduced-motion: reduce) {
      .share-card { animation: none; }
    }
  `],
})
export class ChatRoomShareCardComponent {
  readonly cname = input.required<string>();
  readonly fromName = input.required<string>();
  readonly kind = input.required<'voice' | 'live'>();
  readonly listenerCount = input<number | null>(null);
  readonly isOutbound = input<boolean>(false);
}