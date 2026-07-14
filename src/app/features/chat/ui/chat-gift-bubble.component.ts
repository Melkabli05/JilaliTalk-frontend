import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-chat-gift-bubble',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p class="bubble" [class.is-outbound]="isOutbound()">Gift ×{{ count() }}</p>`,
  styles: [`
    :host { display: contents; }
    .bubble {
      margin: 0; padding: 8px 12px; border-radius: 16px;
      background: var(--color-neutral-100); color: var(--color-text);
      font-style: italic; opacity: 0.95;
      max-width: min(75%, 420px);
      box-shadow: var(--shadow-xs);
    }
    .bubble.is-outbound { background: var(--color-primary-500); color: var(--color-on-color); align-self: flex-end; }
  `],
})
export class ChatGiftBubbleComponent {
  readonly count = input.required<number>();
  readonly isOutbound = input<boolean>(false);
}