import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  computed,
  ElementRef,
  viewChild,
} from '@angular/core';
import {
  LucideChevronLeft,
  LucideInbox,
  LucideMessageCircle,
  LucidePlus,
  LucideSearch,
  LucideSend,
} from '@lucide/angular';
import { ImSocketService } from '@core/realtime/im-socket.service';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { relativeTime } from '@shared/utils';
import { MessageNewContactPanelComponent } from '../../ui/new-contact-panel/messages-new-contact-panel.component';
import { MessagesStore } from '../../store/messages.store';
import { preview, uid, formatDay } from '../../utils/dm-formatting.util';
import type { DmMessage } from '../../models/dm.model';

@Component({
  selector: 'app-messages',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MessagesStore],
  imports: [
    MessageNewContactPanelComponent,
    AvatarComponent,
    LucideChevronLeft,
    LucideInbox,
    LucideMessageCircle,
    LucidePlus,
    LucideSearch,
    LucideSend,
  ],
  templateUrl: './messages-page.html',
  styleUrl: './messages-page.scss',
})
export class MessagesPageComponent {
  protected readonly store = inject(MessagesStore);
  protected readonly imSocket = inject(ImSocketService);
  protected readonly relativeTime = relativeTime;
  protected readonly preview = preview;

  readonly userId = input<number | null>(null);

  protected readonly searchQuery = signal('');
  protected readonly filteredConversations = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const all = this.store.conversations();
    if (!q) return all;
    return all.filter(c => c.nickname.toLowerCase().includes(q) || c.userId.includes(q));
  });

  protected readonly panelOpen = signal(false);
  protected readonly draft = signal('');
  protected readonly canSend = computed(() => this.draft().trim().length > 0);

  private readonly feedEl = viewChild<ElementRef<HTMLElement>>('feed');

  constructor() {
    effect(() => {
      const id = this.userId();
      if (id == null) return;
      this.store.select(String(id));
    });

    effect(() => {
      const conv = this.store.selected();
      if (!conv) return;
      conv.messages.length;
      conv.isTyping;
      const el = this.feedEl()?.nativeElement;
      if (el) Promise.resolve().then(() => { el.scrollTop = el.scrollHeight; });
    });
  }

  protected toggleContactPanel(): void { this.panelOpen.update(v => !v); }
  protected closeContactPanel(): void { this.panelOpen.set(false); }
  protected onContactPicked(userId: number): void {
    this.panelOpen.set(false);
    this.store.select(String(userId));
  }

  protected onInput(value: string): void {
    this.draft.set(value);
    const peerId = Number(this.store.selectedId());
    if (Number.isFinite(peerId)) this.store.sendTyping(peerId, true);
  }

  protected onComposerKeydown(event: Event): void {
    const ke = event as KeyboardEvent;
    if (ke.key !== 'Enter' || ke.shiftKey) return;
    ke.preventDefault();
    this.onSend();
  }

  protected onBlur(): void {
    const peerId = Number(this.store.selectedId());
    if (Number.isFinite(peerId)) this.store.sendTyping(peerId, false);
  }

  protected onSend(): void {
    const text = this.draft().trim();
    if (!text) return;
    const peerId = Number(this.store.selectedId());
    if (!Number.isFinite(peerId)) return;

    const msgId = uid();
    const now = Date.now();
    this.store.sendDm(peerId, 'text', {
      msgId,
      text,
      fromNickname: 'You',
      fromProfileTs: now,
    });
    this.store.pushPublic(String(peerId), 'You', {
      id: msgId,
      type: 'text',
      text,
      ts: now,
      delivery: 'sent',
    });
    this.draft.set('');
    this.store.sendTyping(peerId, false);
  }

  /** Show "Today" / "Yesterday" / "Jun 12" pill at the first message of each day. */
  protected dayLabel(messages: readonly DmMessage[], i: number): string | null {
    const cur = messages[i];
    if (!cur) return null;
    if (i > 0) {
      const prev = messages[i - 1];
      if (prev && new Date(prev.ts).toDateString() === new Date(cur.ts).toDateString()) {
        return null;
      }
    }
    return formatDay(cur.ts);
  }
}
