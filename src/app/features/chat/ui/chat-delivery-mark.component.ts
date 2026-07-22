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
  host: { class: 'inline-flex self-end' },
  template: `
    @if (iconKind(); as kind) {
      <span [class]="markClass()" [attr.aria-label]="ariaLabel()" aria-hidden="true">
        @if (kind === 'single') {
          <svg aria-hidden="true" lucideCheck [size]="12"></svg>
        } @else {
          <svg aria-hidden="true" lucideCheckCheck [size]="12"></svg>
        }
      </span>
    }
  `,
  /** Two bespoke keyframes: `deliveryRead`'s pop-in confirmation (WhatsApp/Telegram-style
   *  blue-tick moment) and `deliveryShift`'s muted fade for non-read state changes — neither
   *  has a Tailwind built-in shape. */
  styles: [`
    @keyframes deliveryRead {
      0%   { transform: scale(0.85); opacity: 0.4; }
      60%  { transform: scale(1.15); opacity: 1; }
      100% { transform: scale(1); opacity: 1; }
    }
    @keyframes deliveryShift {
      0%   { opacity: 0.55; }
      100% { opacity: 1; }
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

  protected readonly markClass = computed(() => {
    const base = "inline-flex items-center leading-none px-0.5 shrink-0 motion-reduce:[transition:none] motion-reduce:animate-none";
    return this.delivery() === 'read'
      ? `${base} text-blue-500 [transition:color_220ms_ease,transform_220ms_cubic-bezier(0.2,0.8,0.2,1)] animate-[deliveryRead_380ms_cubic-bezier(0.2,0.8,0.2,1)]`
      : `${base} text-neutral-500 dark:text-neutral-400 [transition:color_220ms_ease,transform_220ms_cubic-bezier(0.2,0.8,0.2,1)] animate-[deliveryShift_220ms_ease]`;
  });
}
