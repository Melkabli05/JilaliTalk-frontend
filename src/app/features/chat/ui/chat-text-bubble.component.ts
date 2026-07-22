import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { ChatDelivery } from '../models/chat-message.model';

@Component({
  selector: 'app-chat-text-bubble',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p [class]="isOutbound() ? 'bubble self-end rtl:self-start' : 'bubble self-start rtl:self-end'">{{ text() }}</p>
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
    .bubble.self-end { background: var(--color-primary-500); color: var(--color-on-color); }
    :host-context(.dark) .bubble { background: var(--color-neutral-800); }
    :host-context(.dark) .bubble.self-end { background: var(--color-primary-600); }
  `],
})
export class ChatTextBubbleComponent {
  readonly text = input.required<string>();
  readonly isOutbound = input<boolean>(false);
}