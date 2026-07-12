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
import { HtImConnectionService } from '@core/realtime/ht-im-connection.service';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { relativeTime } from '@shared/utils';
import { MessageNewContactPanelComponent } from '../../ui/new-contact-panel/messages-new-contact-panel.component';
import { MessagesStore } from '../../store/messages.store';
import { preview, dayLabel } from '../../utils/dm-formatting.util';

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
  protected readonly filteredConversations = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const all = this.store.conversations();
    if (!q) return all;
    return all.filter(c => c.nickname.toLowerCase().includes(q) || c.userId.includes(q));
  });

  protected readonly panelOpen = signal(false);
  protected readonly draft = signal('');
  protected readonly canSend = computed(() => this.draft().trim().length > 0);
  protected readonly dayLabel = dayLabel;

  private readonly selectedPeerId = computed(() => {
    const n = Number(this.store.selectedId());
    return Number.isFinite(n) ? n : null;
  });

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
    const peerId = this.selectedPeerId();
    if (peerId != null) this.store.sendTyping(peerId, true);
  }

  protected onComposerKeydown(event: Event): void {
    const ke = event as KeyboardEvent;
    if (ke.key !== 'Enter' || ke.shiftKey) return;
    ke.preventDefault();
    this.onSend();
  }

  protected onBlur(): void {
    const peerId = this.selectedPeerId();
    if (peerId != null) this.store.sendTyping(peerId, false);
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
    this.store.sendTyping(peerId, false);
  }
}
