import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import type { ChatConversation } from '../models/chat-message.model';
import { lastMessagePreview } from '../utils/chat-preview.util';

@Component({
  selector: 'app-chat-conversation-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent],
  host: { class: 'contents' },
  template: `
    <button
      type="button"
      [class]="rowClass()"
      (click)="select.emit()"
      [attr.aria-current]="active() ? 'true' : null"
    >
      <app-avatar
        [src]="conversation().headUrl ?? ''"
        [initials]="initials()"
        [alt]="conversation().nickname"
        [size]="avatarSize()"
        [ringColor]="active() ? '#3b82f6' : null"
      />
      <span class="flex flex-col gap-0.5 min-w-0">
        <span [class]="unread() > 0 ? nameClassBold : nameClassRegular">{{ conversation().nickname }}</span>
        <time [class]="unread() > 0 ? tsClassUnread : tsClassDefault" [attr.datetime]="conversation().lastTs">
          {{ relativeTime(conversation().lastTs) }}
        </time>
        @if (conversation().isTyping) {
          <span class="text-xs text-blue-500 italic whitespace-nowrap overflow-hidden text-ellipsis">typing…</span>
        } @else {
          <span class="text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap overflow-hidden text-ellipsis">{{ preview() }}</span>
        }
      </span>
      @if (unread() > 0) {
        <span
          class="min-w-[18px] h-[18px] px-1.5 inline-flex items-center justify-center rounded-full
                 bg-emerald-500 text-white text-[10px] font-bold
                 animate-[badgeIn_200ms_cubic-bezier(0.34,1.56,0.64,1)_both] motion-reduce:animate-none"
          [attr.aria-label]="unread() + ' unread'"
        >
          {{ unread() > 99 ? '99+' : unread() }}
        </span>
      }
    </button>
  `,
  /** The unread-badge pop-in has no Tailwind built-in animation shape. */
  styles: [`
    @keyframes badgeIn {
      from { opacity: 0; transform: scale(0.5); }
      to { opacity: 1; transform: scale(1); }
    }
  `],
})
export class ChatConversationRowComponent {
  readonly conversation = input.required<ChatConversation>();
  readonly active = input<boolean>(false);
  readonly avatarSize = input<'sm' | 'md' | 'lg'>('md');
  readonly formatTime = input<(ts: number) => string>((ts) => new Date(ts).toLocaleString());

  readonly select = output<void>();

  readonly unread = computed(() => this.conversation().unread);
  readonly preview = computed(() => lastMessagePreview(this.conversation()));
  readonly initials = computed(() => deriveInitials(this.conversation().nickname));
  readonly relativeTime = (ts: number): string => this.formatTime()(ts);

  protected readonly rowClass = computed(() => {
    const base =
      'grid grid-cols-[auto_1fr_auto] items-center gap-3 w-full min-h-11 py-2.5 px-3 rtl:[direction:rtl] ' +
      'bg-transparent border-0 cursor-pointer rounded-xl text-left text-inherit touch-manipulation ' +
      '[-webkit-tap-highlight-color:transparent] transition-colors duration-150 motion-reduce:transition-none ' +
      'focus-visible:outline focus-visible:outline-2 focus-visible:[outline-offset:-2px] focus-visible:outline-blue-500';
    return this.active()
      ? `${base} bg-blue-500/10 dark:bg-blue-500/16`
      : `${base} hover:bg-neutral-100 dark:hover:bg-neutral-700`;
  });

  protected readonly nameClassBold = 'text-sm font-bold text-neutral-900 dark:text-neutral-100 whitespace-nowrap overflow-hidden text-ellipsis';
  protected readonly nameClassRegular = 'text-sm font-medium text-neutral-900 dark:text-neutral-100 whitespace-nowrap overflow-hidden text-ellipsis';
  protected readonly tsClassUnread = 'text-[10px] text-emerald-600 font-medium';
  protected readonly tsClassDefault = 'text-[10px] text-neutral-500 dark:text-neutral-400';
}

function deriveInitials(nickname: string): string {
  const trimmed = nickname.trim();
  if (!trimmed) return '?';
  const first = [...trimmed][0];
  return first ? first.toUpperCase() : '?';
}