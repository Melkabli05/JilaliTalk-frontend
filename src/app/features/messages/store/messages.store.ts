import { DestroyRef, Service, computed, effect, inject, signal } from '@angular/core';
import { HtImConnectionService } from '@core/realtime/ht-im-connection.service';
import type { ImEventSource, ImMessageSender } from '@core/realtime/im-connection-roles';
import { StorageService } from '@core/services/storage.service';
import { UserInfoService } from '@core/services/user-info.service';
import { AuthStore } from '@core/auth/auth.store';
import type { ImEvent } from '@core/realtime/im-events';
import type { DmConversation, DmMessage } from '../models/dm.model';
import { buildDmSendPayload } from '../utils/dm-send-payload.util';
import type { DmKind, SendDmBody } from '../utils/dm-send-payload.util';
import { mapImEventToDmMessage } from '../utils/dm-event-mapper.util';
import {
  markConversationRead,
  setConversationTyping,
  updateMessageDelivery,
  upsertConversationMessage,
} from '../utils/dm-conversation.util';
import { DmConversationPersistence } from '../utils/dm-conversation-persistence';

export type { DmKind, SendDmBody } from '../utils/dm-send-payload.util';

const STORAGE_KEY = 'jilali_dm_v1';
const MAX_CONVERSATIONS = 100;
/** Coalesces bursts of rapid store mutations (a peer's per-keystroke typing indicator, a
 *  fast run of incoming messages) into one write instead of re-serializing the whole
 *  conversation table synchronously on every single signal change. */
const PERSIST_DEBOUNCE_MS = 500;

/**
 * Owns DM conversation state for one messages-page visit (page-scoped, not root — see
 * `providers:` on `MessagesPageComponent`). Delegates everything that isn't "own the
 * signals and orchestrate" to focused collaborators: `dm-event-mapper.util.ts` (inbound
 * ImEvent → DmMessage), `dm-conversation.util.ts` (pure conversation-map transforms),
 * `dm-send-payload.util.ts` (outbound DM → wire payload), and `DmConversationPersistence`
 * (debounced localStorage read/write). This class's own job shrinks to: read the IM event
 * log, dispatch to the right collaborator, and expose read-only computed signals.
 */
@Service({ autoProvided: false })
export class MessagesStore {
  private readonly htIm: ImEventSource & ImMessageSender = inject(HtImConnectionService);
  private readonly userInfoService = inject(UserInfoService);
  private readonly authStore = inject(AuthStore);
  private readonly destroyRef = inject(DestroyRef);

  private readonly persistence = new DmConversationPersistence(
    inject(StorageService),
    STORAGE_KEY,
    MAX_CONVERSATIONS,
    PERSIST_DEBOUNCE_MS,
  );

  private readonly _convMap = signal<ReadonlyMap<string, DmConversation>>(this.persistence.load());
  /** msgId → userId, so a MSG-ACK/read-receipt (which only carries a msgId) can find the
   *  conversation to update without scanning every conversation's message list. Pruned in
   *  `pushPublic` whenever `upsertConversationMessage` evicts old messages past the
   *  per-conversation cap — otherwise this index would grow for the lifetime of the store
   *  even for messages no longer in any conversation's retained window. */
  private readonly _msgIndex = new Map<string, string>();
  private readonly _selectedId = signal<string | null>(null);
  private processedEventCount = 0;

  readonly conversations = computed(() =>
    [...this._convMap().values()].map(c => this.resolveDisplayIdentity(c)).sort((a, b) => b.lastTs - a.lastTs),
  );
  readonly selectedId = this._selectedId.asReadonly();
  readonly selected = computed(() => {
    const id = this._selectedId();
    const c = id ? this._convMap().get(id) : null;
    return c ? this.resolveDisplayIdentity(c) : null;
  });
  readonly totalUnread = computed(() =>
    [...this._convMap().values()].reduce((s, c) => s + c.unread, 0),
  );

  constructor() {
    effect(() => {
      const events = this.htIm.events();
      if (events.length < this.processedEventCount) {
        // Log was reset (disconnect/reconnect) — start over from the beginning.
        this.processedEventCount = 0;
      }
      for (const event of events.slice(this.processedEventCount)) {
        this.dispatch(event);
      }
      this.processedEventCount = events.length;
    });

    effect(() => {
      this.persistence.schedule(this._convMap());
    });

    // A conversation ends up with its raw userId as the "nickname" (and no avatar) whenever
    // it's created before a real profile was available — e.g. selecting a peer we've never
    // seen elsewhere in the app, so UserInfoService's cache is empty for them — and nothing
    // corrected it afterwards, since select()'s fallback and pushPublic()'s upsert both only
    // run once per conversation-touching action. This fetches the real profile in the
    // background for any conversation still missing one; resolveDisplayIdentity() picks it
    // up reactively once UserInfoService's cache updates, the same "trigger + read via
    // computed" pattern this service's own doc comment describes as the intended usage.
    effect(() => {
      for (const c of this._convMap().values()) {
        if (c.nickname !== c.userId && c.headUrl) continue;
        const numeric = Number(c.userId);
        if (Number.isFinite(numeric)) this.userInfoService.ensureFresh(numeric);
      }
    });

    this.destroyRef.onDestroy(() => this.persistence.flush());
  }

  /** Prefers UserInfoService's live cache over the conversation's own stored nickname/avatar
   *  when those are missing (nickname still the raw userId, or no avatar at all) — see the
   *  constructor effect that keeps the cache populated for exactly this case. */
  private resolveDisplayIdentity(conv: DmConversation): DmConversation {
    if (conv.nickname !== conv.userId && conv.headUrl) return conv;
    const numeric = Number(conv.userId);
    const info = Number.isFinite(numeric) ? this.userInfoService.getUserInfo(numeric) : null;
    if (!info) return conv;
    const nickname = conv.nickname === conv.userId ? info.nickname?.trim() : null;
    const headUrl = conv.headUrl ? null : info.details?.base?.headUrl;
    if (!nickname && !headUrl) return conv;
    return { ...conv, ...(nickname ? { nickname } : {}), ...(headUrl ? { headUrl } : {}) };
  }

  select(userId: string): void {
    this._selectedId.set(userId);
    const numeric = Number(userId);
    const info = Number.isFinite(numeric) ? this.userInfoService.getUserInfo(numeric) : null;
    const fallbackNickname = info?.nickname?.trim() || info?.username?.trim() || userId;
    const fallbackHeadUrl = info?.details?.base?.headUrl ?? null;
    this._convMap.update(m => markConversationRead(m, userId, fallbackNickname, fallbackHeadUrl));

    const msgId = Number.isFinite(numeric) ? this.lastInboundMsgId(numeric) : null;
    if (msgId != null) this.markReadForLastInbound(numeric, msgId);
  }

  back(): void {
    this._selectedId.set(null);
  }

  markReadForLastInbound(peerId: number, msgId: string): void {
    this.htIm.sendReadReceipt(peerId, msgId);
  }

  lastInboundMsgId(peerId: number): string | null {
    const c = this._convMap().get(String(peerId));
    return c?.messages.at(-1)?.id ?? null;
  }

  sendTyping(peerId: number, isTyping: boolean): void {
    this.htIm.sendTyping(peerId, isTyping);
  }

  /** Returns the sent msgId, or `null` if the send never reached the wire (no payload could
   *  be built, or the socket isn't open) — callers must check this instead of assuming the
   *  send succeeded, since nothing else here surfaces the failure. */
  sendDm(peerId: number, kind: DmKind, fields: Partial<SendDmBody>): string | null {
    const payload = buildDmSendPayload(kind, fields);
    if (!payload) return null;
    const self = this.authStore.user();
    return this.htIm.sendDm(peerId, payload, self?.nickname ?? '', 0, fields.msgId);
  }

  pushPublic(userId: string, nickname: string, headUrl: string | null, msg: DmMessage): void {
    const isSelected = this._selectedId() === userId;
    const { map, evictedMessageIds } =
      upsertConversationMessage(this._convMap(), userId, nickname, headUrl, msg, isSelected);
    for (const evictedId of evictedMessageIds) this._msgIndex.delete(evictedId);
    if (msg.id) this._msgIndex.set(msg.id, userId);
    this._convMap.set(map);
  }

  private dispatch(ev: ImEvent): void {
    const mapped = mapImEventToDmMessage(ev);
    if (mapped) {
      this.pushPublic(mapped.userId, mapped.nickname, mapped.headUrl, mapped.message);
      return;
    }
    switch (ev.type) {
      case 'typing_indicator':
        this._convMap.update(m => setConversationTyping(m, ev.fromUserId, ev.isTyping));
        break;
      case 'message_ack':
        this.updateDeliveryForMsgId(ev.msgId, ev.prefix !== 0 ? 'delivered' : null, 'sent');
        break;
      case 'read_receipt':
        this.updateDeliveryForMsgId(ev.msgId, 'read', 'sent', 'delivered');
        break;
      default:
        break;
    }
  }

  private updateDeliveryForMsgId(
    msgId: string,
    to: DmMessage['delivery'] | null,
    ...from: readonly NonNullable<DmMessage['delivery']>[]
  ): void {
    if (!to || !msgId) return;
    const userId = this._msgIndex.get(msgId);
    if (userId == null) return;
    this._convMap.update(m => updateMessageDelivery(m, userId, msgId, to, from));
  }
}
