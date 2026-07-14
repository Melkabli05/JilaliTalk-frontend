import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { ChatDelivery } from '../models/chat-message.model';

@Component({
  selector: 'app-chat-text-bubble',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="bubble" [class.is-outbound]="isOutbound()">{{ text() }}</p>
  `,
  styles: [`
    :host { display: contents; }
    .bubble {
      margin: 0; padding: 8px 12px; border-radius: 16px; line-height: 1.35;
      background: var(--color-neutral-100); color: var(--color-text);
      max-width: min(75%, 420px);
      word-wrap: break-word; overflow-wrap: anywhere;
      white-space: pre-wrap;
      box-shadow: var(--shadow-xs);
    }
    .bubble.is-outbound { background: var(--color-primary-500); color: var(--color-on-color); align-self: flex-end; }
    :host-context(.dark) .bubble { background: var(--color-neutral-800); }
    :host-context(.dark) .bubble.is-outbound { background: var(--color-primary-600); }
    :host-context([dir='rtl']) .bubble.is-outbound { align-self: flex-start; }
  `],
})
export class ChatTextBubbleComponent {
  readonly text = input.required<string>();
  readonly isOutbound = input<boolean>(false);
}