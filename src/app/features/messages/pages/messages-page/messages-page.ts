import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
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
import { HtImConnectionService } from '@core/realtime/ht-im-connection.service';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { relativeTime } from '@shared/utils';
import { MessageNewContactPanelComponent } from '../../ui/new-contact-panel/messages-new-contact-panel.component';
import { MessagesStore } from '../../store/messages.store';
import { preview, dayLabel } from '../../utils/dm-formatting.util';
import { filterConversationsByQuery } from '../../utils/dm-conversation.util';
import { DmTypingBroadcaster } from '../../utils/dm-typing-broadcaster';

/** How long to wait after the last keystroke before telling the peer typing stopped —
 *  also the minimum gap between repeated "started typing" sends while the user keeps
 *  typing continuously, so a WS packet doesn't go out on every single keystroke. */
const TYPING_STOP_DELAY_MS = 3_000;

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
  protected readonly imSocket = inject(HtImConnectionService);
  protected readonly relativeTime = relativeTime;
  protected readonly preview = preview;

  readonly userId = input<number | null>(null);

  protected readonly searchQuery = signal('');
  protected readonly filteredConversations = computed(() =>
    filterConversationsByQuery(this.store.conversations(), this.searchQuery()),
  );

  protected readonly panelOpen = signal(false);
  protected readonly draft = signal('');
  protected readonly canSend = computed(() => this.draft().trim().length > 0);
  protected readonly dayLabel = dayLabel;

  private readonly selectedPeerId = computed(() => {
    const n = Number(this.store.selectedId());
    return Number.isFinite(n) ? n : null;
  });

  private readonly feedEl = viewChild<ElementRef<HTMLElement>>('feed');

  private readonly typingBroadcaster = new DmTypingBroadcaster(
    (peerId, isTyping) => this.store.sendTyping(peerId, isTyping),
    TYPING_STOP_DELAY_MS,
  );

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

    inject(DestroyRef).onDestroy(() => {
      const peerId = this.selectedPeerId();
      if (peerId != null) this.typingBroadcaster.stop(peerId);
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
    const peerId = this.selectedPeerId();
    if (peerId != null) this.typingBroadcaster.notifyInput(peerId);
  }

  protected onComposerKeydown(event: Event): void {
    const ke = event as KeyboardEvent;
    if (ke.key !== 'Enter' || ke.shiftKey) return;
    ke.preventDefault();
    this.onSend();
  }

  protected onBlur(): void {
    const peerId = this.selectedPeerId();
    if (peerId != null) this.typingBroadcaster.stop(peerId);
  }

  protected onSend(): void {
    const text = this.draft().trim();
    const peerId = this.selectedPeerId();
    if (!text || peerId == null) return;

    const msgId = crypto.randomUUID();
    const now = Date.now();
    this.store.sendDm(peerId, 'text', { msgId, text, fromNickname: 'You', fromProfileTs: now });
    this.store.pushPublic(String(peerId), 'You', { id: msgId, type: 'text', text, ts: now, delivery: 'sent' });
    this.draft.set('');
    this.typingBroadcaster.stop(peerId);
  }
}
