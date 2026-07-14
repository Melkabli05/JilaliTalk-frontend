import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { ChatDelivery } from '../models/chat-message.model';

@Component({
  selector: 'app-chat-delivery-mark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (delivery()) {
      <span class="delivery-mark" [class.read]="delivery() === 'read'" aria-hidden="true">
        {{ delivery() === 'sent' ? '✓' : '✓✓' }}
      </span>
    }
  `,
  styles: [`
    :host { display: inline-flex; align-self: end; }
    .delivery-mark {
      font-size: var(--text-xs); color: var(--color-text-muted);
      line-height: 1; padding: 0 2px; flex-shrink: 0;
    }
    .delivery-mark.read { color: var(--color-primary-500); }
  `],
})
export class ChatDeliveryMarkComponent {
  readonly delivery = input<ChatDelivery | null>(null);
}