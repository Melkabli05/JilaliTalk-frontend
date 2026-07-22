import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import type { ChatConversation } from '../models/chat-message.model';
import { lastMessagePreview } from '../utils/chat-preview.util';

@Component({
  selector: 'app-chat-conversation-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent],
  template: `
    <button
      type="button"
      class="row rtl:[direction:rtl]"
      [class.active]="active()"
      [class.unread]="unread()"
      (click)="select.emit()"
      [attr.aria-current]="active() ? 'true' : null"
    >
      <app-avatar
        [src]="conversation().headUrl ?? ''"
        [initials]="initials()"
        [alt]="conversation().nickname"
        [size]="avatarSize()"
        [ringColor]="active() ? 'var(--color-primary-500)' : null"
      />
      <span class="row-body">
        <span class="row-name">{{ conversation().nickname }}</span>
        <time class="row-ts" [attr.datetime]="conversation().lastTs">
          {{ relativeTime(conversation().lastTs) }}
        </time>
        @if (conversation().isTyping) {
          <span class="row-preview row-preview--typing">typing…</span>
        } @else {
          <span class="row-preview">{{ preview() }}</span>
        }
      </span>
      @if (unread() > 0) {
        <span class="unread-badge" [attr.aria-label]="unread() + ' unread'">
          {{ unread() > 99 ? '99+' : unread() }}
        </span>
      }
    </button>
  `,
  styles: [`
    :host { display: contents; }
    .row {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center; gap: 12px;
      width: 100%; min-height: 44px; padding: 10px 12px;
      background: transparent; border: 0; cursor: pointer;
      border-radius: 12px; text-align: left; color: inherit;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      transition: background-color 150ms ease;
    }
    .row:hover { background: var(--color-neutral-100); }
    .row.active { background: color-mix(in srgb, var(--color-primary-500) 10%, transparent); }
    .row:focus-visible { outline: var(--focus-ring); outline-offset: -2px; }
    :host-context(.dark) .row:hover { background: var(--color-neutral-700); }
    :host-context(.dark) .row.active { background: color-mix(in srgb, var(--color-primary-500) 16%, transparent); }
    .row-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .row-name {
      font-size: var(--text-sm); font-weight: var(--font-medium); color: var(--color-text);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .unread .row-name { font-weight: var(--font-bold); }
    .row-ts { font-size: var(--text-2xs); color: var(--color-text-muted); }
    .unread .row-ts { color: var(--color-accent-600); font-weight: var(--font-medium); }
    .row-preview {
      font-size: var(--text-xs); color: var(--color-text-muted);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .row-preview--typing { color: var(--color-primary-500); font-style: italic; }
    .unread-badge {
      min-width: 18px; height: 18px; padding: 0 6px;
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: var(--radius-full);
      background: var(--color-accent-500); color: var(--color-on-color);
      font-size: var(--text-2xs); font-weight: var(--font-bold);
      animation: badgeIn 200ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
    }
    @keyframes badgeIn {
      from { opacity: 0; transform: scale(0.5); }
      to { opacity: 1; transform: scale(1); }
    }
    @media (prefers-reduced-motion: reduce) {
      .row { transition: none; }
      .unread-badge { animation: none; }
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
}

function deriveInitials(nickname: string): string {
  const trimmed = nickname.trim();
  if (!trimmed) return '?';
  const first = [...trimmed][0];
  return first ? first.toUpperCase() : '?';
}