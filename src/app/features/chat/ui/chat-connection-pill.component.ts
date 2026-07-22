import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { ChatConnectionStatus } from '../models/chat-message.model';
import { connectionStatusLabel } from '../utils/chat-status-label.util';

@Component({
  selector: 'app-chat-connection-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  template: `
    <span
      [class]="pillClass()"
      [attr.role]="status() === 'disconnected' ? 'button' : null"
      [attr.tabindex]="status() === 'disconnected' ? 0 : null"
      [attr.aria-label]="label()"
      [title]="label()"
      (click)="retry.emit()"
      (keydown.enter)="retry.emit()"
      (keydown.space)="$event.preventDefault(); retry.emit()"
    >
      <span [class]="dotClass()" aria-hidden="true"></span>
      <span>{{ label() }}</span>
    </span>
  `,
  /** The connecting-state pulse has no Tailwind built-in animation shape. */
  styles: [`
    @keyframes pillPulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.85); }
    }
  `],
})
export class ChatConnectionPillComponent {
  readonly status = input.required<ChatConnectionStatus>();
  readonly retry = output<void>();

  readonly label = computed(() => connectionStatusLabel(this.status()));

  protected readonly pillClass = computed(() => {
    const tappable = this.status() === 'disconnected';
    const base = 'inline-flex items-center gap-1.5 rounded-full border select-none font-medium text-xs ' +
      'bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400';
    return tappable
      ? `${base} py-2 px-3 cursor-pointer touch-manipulation [-webkit-tap-highlight-color:transparent] ` +
        'transition-[background-color,transform] duration-150 motion-reduce:transition-none ' +
        'hover:bg-neutral-200 dark:hover:bg-neutral-700 active:scale-[0.96] motion-reduce:active:scale-100 ' +
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'
      : `${base} py-1 px-2.5 cursor-default`;
  });

  protected readonly dotClass = computed(() => {
    const base = 'w-2 h-2 rounded-full transition-colors duration-200 motion-reduce:transition-none';
    switch (this.status()) {
      case 'connected':
        return `${base} bg-emerald-500 shadow-[0_0_0_2px_rgb(16_185_129/25%)]`;
      case 'connecting':
      case 'reconnecting':
        return `${base} bg-amber-400 animate-[pillPulse_1.2s_ease-in-out_infinite] motion-reduce:animate-none`;
      case 'disconnected':
        return `${base} bg-red-500`;
      default:
        return `${base} bg-neutral-300`;
    }
  });
}