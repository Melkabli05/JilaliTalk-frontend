import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { ChatDelivery } from '../models/chat-message.model';

@Component({
  selector: 'app-chat-delivery-mark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (delivery(); as state) {
      <span class="delivery-mark" [class.read]="state === 'read'" aria-hidden="true">
        {{ state === 'sent' ? '✓' : '✓✓' }}
      </span>
      <span class="visually-hidden">{{ state }}</span>
    }
  `,
  styles: [`
    :host { display: inline-flex; align-self: end; }
    .delivery-mark {
      font-size: var(--text-xs); color: var(--color-text-muted);
      line-height: 1; padding: 0 2px; flex-shrink: 0;
    }
    .delivery-mark.read { color: var(--color-primary-500); }
    .visually-hidden {
      position: absolute; width: 1px; height: 1px; padding: 0;
      margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0);
      white-space: nowrap; border: 0;
    }
  `],
})
export class ChatDeliveryMarkComponent {
  readonly delivery = input<ChatDelivery | null>(null);
}