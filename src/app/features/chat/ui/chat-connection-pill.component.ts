import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { ChatConnectionStatus } from '../models/chat-message.model';
import { connectionStatusLabel } from '../utils/chat-status-label.util';

@Component({
  selector: 'app-chat-connection-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="pill"
      [class.connected]="status() === 'connected'"
      [class.connecting]="status() === 'connecting' || status() === 'reconnecting'"
      [class.disconnected]="status() === 'disconnected'"
      [class.tappable]="status() === 'disconnected'"
      [attr.role]="status() === 'disconnected' ? 'button' : null"
      [attr.tabindex]="status() === 'disconnected' ? 0 : null"
      [attr.aria-label]="label()"
      [title]="label()"
      (click)="retry.emit()"
      (keydown.enter)="retry.emit()"
      (keydown.space)="$event.preventDefault(); retry.emit()"
    >
      <span class="dot" aria-hidden="true"></span>
      <span class="text">{{ label() }}</span>
    </span>
  `,
  styles: [`
    :host { display: inline-flex; }
    .pill {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 4px 10px; border-radius: var(--radius-full);
      background: var(--color-neutral-100); border: 1px solid var(--color-border);
      color: var(--color-text-muted);
      font-size: var(--text-xs); font-weight: var(--font-medium);
      cursor: default; user-select: none;
    }
    .pill.tappable {
      cursor: pointer; padding: 8px 12px;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }
    .pill.tappable:focus-visible { outline: var(--focus-ring); outline-offset: 2px; }
    :host-context(.dark) .pill { background: var(--color-neutral-800); border-color: var(--color-neutral-700); }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--color-neutral-300); transition: background-color 200ms ease; }
    .connected .dot { background: var(--color-accent-500); box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent-500) 25%, transparent); }
    .connecting .dot { background: var(--color-gold-400); animation: pillPulse 1.2s ease-in-out infinite; }
    .disconnected .dot { background: var(--color-warm-500); }
    @keyframes pillPulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.85); }
    }
    @media (prefers-reduced-motion: reduce) {
      .dot { animation: none; }
    }
  `],
})
export class ChatConnectionPillComponent {
  readonly status = input.required<ChatConnectionStatus>();
  readonly retry = output<void>();

  readonly label = computed(() => connectionStatusLabel(this.status()));
}