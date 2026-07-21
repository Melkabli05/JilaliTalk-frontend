import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LucideCheck, LucideCheckCheck } from '@lucide/angular';
import type { ChatDelivery } from '../models/chat-message.model';

/**
 * Per-message delivery state visual:
 *   - 'sent':      single muted check
 *   - 'delivered': double muted checks (read by server, not yet read by peer)
 *   - 'read':      double primary-coloured checks (peer has opened the chat)
 *   - 'failed':    not rendered here — the chat page template renders the
 *                  "Failed · Retry" button in the msg-meta slot instead
 *                  (so failed bubbles get an actionable affordance, not a glyph).
 */
@Component({
  selector: 'app-chat-delivery-mark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideCheck, LucideCheckCheck],
  template: `
    @if (iconKind(); as kind) {
      <span class="delivery-mark" [class.is-read]="delivery() === 'read'" [attr.aria-label]="ariaLabel()" aria-hidden="true">
        @if (kind === 'single') {
          <svg aria-hidden="true" lucideCheck [size]="12"></svg>
        } @else {
          <svg aria-hidden="true" lucideCheckCheck [size]="12"></svg>
        }
      </span>
    }
  `,
  styles: [`
    :host { display: inline-flex; align-self: end; }
    .delivery-mark {
      display: inline-flex; align-items: center;
      color: var(--color-text-muted);
      line-height: 1; padding: 0 2px; flex-shrink: 0;
      transition: color 220ms ease, transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    /* Subtle pop when transitioning into the 'read' state — gives a small
       confirmation that the peer opened the chat, the way WhatsApp/Telegram
       show a brief blue-tick tick animation. */
    .delivery-mark.is-read {
      color: var(--color-primary-500);
      animation: deliveryRead 380ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    @keyframes deliveryRead {
      0%   { transform: scale(0.85); opacity: 0.4; }
      60%  { transform: scale(1.15); opacity: 1; }
      100% { transform: scale(1); opacity: 1; }
    }
    /* Same animation but muted color (gray) for 'sent' state changes — keeps the
       transition visible without screaming for attention. */
    .delivery-mark { animation: deliveryShift 220ms ease; }
    @keyframes deliveryShift {
      0%   { opacity: 0.55; }
      100% { opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce) {
      .delivery-mark, .delivery-mark.is-read { animation: none; }
    }
  `],
})
export class ChatDeliveryMarkComponent {
  readonly delivery = input<ChatDelivery | null>(null);

  /** Icon glyph kind — only 'sent' (single check) or delivered/read (double check) need
   *  visual marks here; 'failed' is rendered as an action button in the parent. */
  protected readonly iconKind = computed<'single' | 'double' | null>(() => {
    const d = this.delivery();
    if (d === 'sent') return 'single';
    if (d === 'delivered' || d === 'read') return 'double';
    return null;
  });

  protected readonly ariaLabel = computed(() => {
    switch (this.delivery()) {
      case 'sent': return 'Sent';
      case 'delivered': return 'Delivered';
      case 'read': return 'Read';
      default: return '';
    }
  });
}
