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
    }
    .share-card.is-outbound { align-self: flex-end; background: var(--color-neutral-200); }
    :host-context(.dark) .share-card { background: var(--color-neutral-800); }
    :host-context(.dark) .share-card.is-outbound { background: var(--color-neutral-700); }
    .share-label { font-size: var(--text-xs); font-weight: var(--font-semibold); }
    .share-detail { font-size: var(--text-sm); color: var(--color-text-muted); }
  `],
})
export class ChatRoomShareCardComponent {
  readonly cname = input.required<string>();
  readonly fromName = input.required<string>();
  readonly kind = input.required<'voice' | 'live'>();
  readonly listenerCount = input<number | null>(null);
  readonly isOutbound = input<boolean>(false);
}