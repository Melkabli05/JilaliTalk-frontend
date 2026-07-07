import {
  Component,
  ChangeDetectionStrategy,
  inject,
  ElementRef,
  viewChild,
  effect,
  signal,
  computed,
} from '@angular/core';
import {
  LucideChevronLeft,
  LucideInbox,
  LucideMessageCircle,
  LucideGift,
  LucideCheck,
  LucideCheckCheck,
} from '@lucide/angular';
import { ImSocketService } from '@core/realtime/im-socket.service';
import { AvatarComponent } from '@shared/ui/avatar/avatar.component';
import { relativeTime as formatRelativeTime } from '@shared/utils';
import { MessagesSearchComponent } from '../../ui/search/messages-search';
import { MessagesStore } from '../../store/messages.store';
import type { DmConversation, DmMessage } from '../../models/dm.model';
import { isGroupStart, isGroupEnd, dateLabel, preview, fmtTime } from '../../utils/dm-formatting.util';

@Component({
  selector: 'app-messages',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MessagesStore],
  imports: [
    AvatarComponent,
    MessagesSearchComponent,
    LucideChevronLeft,
    LucideInbox,
    LucideMessageCircle,
    LucideGift,
    LucideCheck,
    LucideCheckCheck,
  ],
  templateUrl: './messages-page.html',
  styleUrl: './messages-page.scss',
})
export class MessagesPageComponent {
  protected readonly store = inject(MessagesStore);
  protected readonly imSocket = inject(ImSocketService);

  protected readonly searchQuery = signal('');

  protected readonly filteredConversations = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const all = this.store.conversations();
    if (!q) return all;
    return all.filter((c) => c.nickname.toLowerCase().includes(q) || c.userId.includes(q));
  });

  private readonly feedEl = viewChild<ElementRef<HTMLElement>>('feed');

  constructor() {
    effect(() => {
      const conv = this.store.selected();
      if (!conv) return;
      conv.messages.length;
      conv.isTyping; // also scroll when typing bubble appears
      const el = this.feedEl()?.nativeElement;
      if (el)
        Promise.resolve().then(() => {
          el.scrollTop = el.scrollHeight;
        });
    });
  }

  /** Delegates to pure helpers in utils/dm-formatting.util.ts so the Angular template
   *  can call them as class members — the formatting logic itself has no `this`
   *  dependency and lives outside the component per this feature's DDD-lite pass. */
  protected isGroupStart(messages: readonly DmMessage[], i: number): boolean {
    return isGroupStart(messages, i);
  }

  protected isGroupEnd(messages: readonly DmMessage[], i: number): boolean {
    return isGroupEnd(messages, i);
  }

  protected dateLabel(messages: readonly DmMessage[], i: number): string | null {
    return dateLabel(messages, i);
  }

  protected preview(conv: DmConversation): string {
    return preview(conv);
  }

  protected fmtTime(ts: number): string {
    return fmtTime(ts);
  }

  /** Delegates to the imported `formatRelativeTime` so the Angular template can call it as
   *  a class member. Aliased on import to avoid shadowing this method. */
  protected formatRelativeTime(ts: number): string {
    return formatRelativeTime(ts);
  }

  // ── Composer ───────────────────────────────────────────────────────────
  // Mirrors the legacy sendTextMessage dispatch: a text field that fires a typing packet
  // on each keystroke (debounced), accepts Enter to send a `text` DM and Shift+Enter for
  // newlines. Read-receipt fires automatically when a conversation becomes selected.

  protected readonly draft = signal('');
  private typingTimer: ReturnType<typeof setTimeout> | null = null;
  private lastTypingFireTs = 0;
  private typingActive = false;

  /** Composite state: draft non-empty → button enabled. */
  protected readonly canSend = computed(() => this.draft().trim().length > 0);

  protected composePlaceholder(): string {
    return 'Message…';
  }

  /** wire onInput: types, debounce-typing, auto-clear. */
  protected onInput(value: string): void {
    this.draft.set(value);
    this.onTyping(true);
  }

  /** Throttle typing-fires to ~5 s while-typing cadence (legacy iOS app re-broadcasts is-typing=true
   *  on a heartbeat) and emits a single is-typing=false on clear/blur/timeout. */
  protected onTyping(active: boolean): void {
    if (!active) {
      if (this.typingTimer !== null) {
        clearTimeout(this.typingTimer);
        this.typingTimer = null;
      }
      if (this.typingActive) {
        this.typingActive = false;
        this.fireTypingForSelection(false);
      }
      return;
    }
    // Auto-stop the typing indicator after 4 s of no further keystrokes.
    if (this.typingTimer !== null) clearTimeout(this.typingTimer);
    this.typingTimer = setTimeout(() => {
      this.onTyping(false);
    }, 4000);

    const peerId = this.selectedPeerNumericId();
    if (peerId == null) return;

    const now = Date.now();
    if (!this.typingActive) {
      this.fireTypingForSelection(true);
      this.typingActive = true;
      this.lastTypingFireTs = now;
    } else if (now - this.lastTypingFireTs >= 5000) {
      // Re-broadcast is-typing=true every 5 s while typing (legacy iOS app's cadence).
      this.fireTypingForSelection(true);
      this.lastTypingFireTs = now;
    }
  }

  /** Enter sends, Shift+Enter newlines. KeyboardEvent#preventDefault on Enter keeps the
   *  text in place per the legacy sendTextMessage API contract. */
  protected onSendKey(event: Event): void {
    const ke = event as KeyboardEvent;
    if (ke.shiftKey) return; // newline
    ke.preventDefault();
    this.onSend();
  }

  /** Decode the selected conversation's userId-string into a number for the API call.
   *  Returns null when the conversation key isn't a clean int (defensive). */
  private selectedPeerNumericId(): number | null {
    const id = this.store.selectedId();
    if (id === null) return null;
    const n = Number(id);
    return Number.isFinite(n) ? n : null;
  }

  private fireTypingForSelection(active: boolean): void {
    const peerId = this.selectedPeerNumericId();
    if (peerId != null) this.store.sendTyping(peerId, active);
  }

  /** Send the current draft as a 1:1 text DM. Echoes locally so the sender sees their own
   *  bubble, then clears the draft. Reads own identity from the auth store (we don't have
   *  it on this component today — see ownUserId comment). */
  protected onSend(): void {
    const text = this.draft().trim();
    if (!text) return;
    const peerId = this.selectedPeerNumericId();
    if (peerId == null) return;

    const msgId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();

    this.store.sendDm(peerId, 'text', {
      msgId,
      text,
      fromId: this.ownUserId() ?? undefined,
      fromNickname: this.ownNickname(),
      fromProfileTs: now,
    });
    // Mirror the sent DM into the local cache so the sender sees their bubble immediately,
    // matching how the inbound path uses push() in MessagesStore.dispatch. delivery: 'sent'
    // kicks the bubble into ✓ state until the upstream MSG-ACK arrives and flips it to 'delivered'.
    this.store.pushPublic(String(peerId), this.ownNickname(), {
      id: msgId,
      type: 'text',
      text,
      ts: now,
      delivery: 'sent',
    });

    this.draft.set('');
    this.onTyping(false);
  }

  /** We don't have a canonical self-id on this component today. The BFF falls back to the
   *  JWT subject when this is null/undefined, which is the desired default. */
  private ownUserId(): number | null {
    return null;
  }

  private ownNickname(): string {
    return 'You';
  }
}
