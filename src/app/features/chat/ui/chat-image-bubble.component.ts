import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-chat-image-bubble',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<img class="bubble-image" [src]="url()" [alt]="alt()" />`,
  styles: [`
    :host { display: contents; }
    .bubble-image {
      max-width: 220px; max-height: 220px;
      border-radius: 12px; display: block;
      box-shadow: var(--shadow-sm);
      cursor: zoom-in;
    }
  `],
})
export class ChatImageBubbleComponent {
  readonly url = input.required<string>();
  /** Descriptive alt text for screen readers; defaults to "Photo" when omitted so the
   *  announcement is never empty. The chat-page passes the sender's name + " sent a photo". */
  readonly alt = input<string>('Photo');
}