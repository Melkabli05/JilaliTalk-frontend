import { Injectable, signal, effect, inject, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Comment, CaptionEntry, CommentOrEvent, EventCard } from '../../data/room-model';
import { CollectionStore } from '@shared/utils/collection-store';
import { BffRoomSocketService } from '@core/realtime/bff-room-socket.service';
import { UserInfoService } from '@core/services/user-info.service';
import { UserRole } from '@core/models/user-role';
import type { GiftEvent } from '@core/realtime/room-realtime-events';
import { RoomApi } from '../../data/room-api';

const ACTIVE_USERS_TTL_MS = 5 * 60 * 1000; // 5 min — prune stale active user entries

type MergedEntry = { readonly item: CommentOrEvent; readonly ts: number };

const GIFT_COMBO_WINDOW_MS = 5_000;

const QUIT_GRACE_MS = 4_000;

@Injectable()
export class CommentsStore extends CollectionStore<Comment> {
  private readonly bffWs = inject(BffRoomSocketService);
  private readonly userInfoService = inject(UserInfoService);
  private readonly api = inject(RoomApi);

  readonly comments = this.items;

  private _currentUserId = 0;
  setCurrentUserId(uid: number): void { this._currentUserId = uid; }

  private readonly _eventCards = signal<readonly EventCard[]>([]);
  readonly eventCards = this._eventCards.asReadonly();

  private readonly _captions = signal<readonly CaptionEntry[]>([]);
  readonly captions = this._captions.asReadonly();

  private readonly activeJoinedUserIds = new Map<number, number>(); // uid → lastSeen ts
  private readonly pendingQuitTimers = new Map<number, ReturnType<typeof setTimeout>>();

  readonly mergedItems = computed<readonly CommentOrEvent[]>(() => {
    const comments: MergedEntry[] = this.items().map((c) => ({ item: c, ts: c.createdAtMs }));
    const cards: MergedEntry[] = this._eventCards().map((c) => ({
      item: this.resolveEventCard(c),
      ts: c.ts,
    }));
    return [...comments, ...cards].sort((a, b) => a.ts - b.ts).map((e) => e.item);
  });

  private pruneActiveUsers(): void {
    const cutoff = Date.now() - ACTIVE_USERS_TTL_MS;
    for (const [uid, ts] of this.activeJoinedUserIds) {
      if (ts < cutoff) this.activeJoinedUserIds.delete(uid);
    }
  }

  private pushUserEventCard(
    kind: EventCard['kind'],
    userId: number,
    idPrefix: string,
    extra: Omit<EventCard, 'kind' | 'id' | 'ts' | 'userId' | 'nickname' | 'headUrl' | 'nationality'>,
  ): void {
    this._eventCards.update((cards) => [
      ...cards,
      {
        kind,
        id: `${idPrefix}-${userId}-${Date.now()}`,
        ts: Date.now(),
        userId,
        nickname: '',
        headUrl: null,
        nationality: null,
        ...extra,
      } as EventCard,
    ]);
    void this.userInfoService.fetchUserInfo(userId);
  }

  /** Backfills nickname/headUrl/nationality from the cached UserInfoService for cards that
   *  arrived with partial data via {@link pushUserEventCard}. Follow cards carry `userId` for
   *  click-to-profile but never `nationality` (the BFF's follow event doesn't include it) and
   *  always arrive fully enriched — so they're excluded from this async-backfill path. */
  private resolveEventCard(card: EventCard): EventCard {
    if (!('userId' in card) || !('nationality' in card) || (card.nickname && card.headUrl && card.nationality)) return card;
    const info = this.userInfoService.getUserInfo(card.userId);
    if (!info) return card;
    return {
      ...card,
      nickname: card.nickname || info.nickname || card.nickname,
      headUrl: card.headUrl || info.details?.base?.headUrl || null,
      nationality: card.nationality || info.nationality || null,
    };
  }

  private addOrComboGift(g: GiftEvent): void {
    const now = Date.now();
    this._eventCards.update((cards) => {
      const last = cards[cards.length - 1];
      const sameCombo = last?.kind === 'gift'
        && last.nickname === g.sendNickname
        && last.receiverNickname === g.receiverNickname
        && now - last.ts <= GIFT_COMBO_WINDOW_MS;

      if (sameCombo) {
        const updated: EventCard = { ...last, ts: now, giftCount: last.giftCount + g.giftNumber };
        return [...cards.slice(0, -1), updated];
      }

      return [
        ...cards,
        {
          kind: 'gift',
          id: `gift-${g.sendUid}-${g.receiverUid}-${now}`,
          ts: now,
          userId: Number(g.sendUid),
          nickname: g.sendNickname,
          headUrl: g.sendHeadUrl,
          nationality: g.sendNation,
          receiverUserId: Number(g.receiverUid),
          receiverNickname: g.receiverNickname,
          receiverHeadUrl: g.receiverHeadUrl,
          receiverNationality: g.receiverNation,
          giftName: '',
          giftCount: g.giftNumber,
          giftIconUrl: g.smallPic,
          coinAmount: g.giftVal,
          vipType: g.vipType,
          giftLevel: g.giftLevel,
        } satisfies EventCard,
      ];
    });
  }

  private scheduleQuitCard(userId: number, originalEventUserId: string): void {
    const timer = setTimeout(() => {
      this.pendingQuitTimers.delete(userId);
      this._eventCards.update((cards) => [
        ...cards,
        {
          kind: 'user_quit',
          id: `quit-${originalEventUserId}-${Date.now()}`,
          ts: Date.now(),
          userId,
          nickname: '',
          headUrl: null,
          nationality: null,
        } satisfies EventCard,
      ]);
    }, QUIT_GRACE_MS);
    this.pendingQuitTimers.set(userId, timer);
  }

  private cancelPendingQuit(userId: number): boolean {
    const timer = this.pendingQuitTimers.get(userId);
    if (!timer) return false;
    clearTimeout(timer);
    this.pendingQuitTimers.delete(userId);
    return true;
  }

  constructor() {
    super();
    effect(() => {
      const event = this.bffWs.lastEvent();
      if (!event) return;
      switch (event.type) {
        case 'comment':
          this.addComment({
            _id: event.comment.id,
            createdAtMs: event.comment.ts,
            updatedAtMs: event.comment.ts,
            userId: Number(event.comment.userId),
            nickname: event.comment.nickname,
            headUrl: event.comment.headUrl,
            nationality: event.comment.nationality,
            role: event.comment.role as UserRole,
            vipType: event.comment.vipType,
            msg: { text: { text: event.comment.text }, replyInfo: event.comment.replyInfo },
            dayRankLevel: event.comment.dayRankLevel,
            giftLevel: event.comment.giftLevel,
            fgLevel: event.comment.fgLevel,
            fgName: event.comment.fgName,
            fgIsActive: event.comment.fgIsActive,
            bubbleId: event.comment.bubbleId,
            bubbleUrl: event.comment.bubbleUrl,
            bubbleColor: event.comment.bubbleColor,
            hitBad: event.comment.hitBad,
            bubbleAnimalType: event.comment.bubbleAnimalType,
            bubbleAnimalUrl: event.comment.bubbleAnimalUrl,
          });
          break;

        case 'gift':
          for (const g of event.gifts) this.addOrComboGift(g);
          break;

        case 'follow':
          this._eventCards.update((cards) => [
            ...cards,
            {
              kind: 'follow',
              id: `follow-${event.nickname}-${Date.now()}`,
              ts: Date.now(),
              userId: Number(event.userId) || 0,
              nickname: event.nickname,
              headUrl: event.headUrl,
              isFollowBack: event.status === 2,
            } satisfies EventCard,
          ]);
          break;

        case 'user_join': {
          this.pruneActiveUsers();
          const userId = Number(event.userId);
          if (this.cancelPendingQuit(userId)) {
            this.activeJoinedUserIds.set(userId, Date.now());
            break;
          }
          if (this.activeJoinedUserIds.has(userId)) break;
          this.activeJoinedUserIds.set(userId, Date.now());
          this.pushUserEventCard('user_join', userId, 'join', {
            nickname: event.nickname,
            headUrl: event.headUrl,
            nationality: event.nationality,
          });
          break;
        }

        case 'user_quit': {
          this.pruneActiveUsers();
          const userId = Number(event.userId);
          this.activeJoinedUserIds.delete(userId);
          this.scheduleQuitCard(userId, event.userId);
          void this.userInfoService.fetchUserInfo(userId);
          break;
        }

        case 'stage_raisehand': {
          const userId = Number(event.userId);
          this.pushUserEventCard('stage_raisehand', userId, 'hand', { isRaised: event.raisehandType === 1 });
          break;
        }

        case 'whiteboard_activated':
          this._eventCards.update((cards) => [
            ...cards,
            {
              kind: 'whiteboard_activated',
              id: `wb-on-${Date.now()}`,
              ts: Date.now(),
              activated: true,
            } satisfies EventCard,
          ]);
          break;

        case 'whiteboard_deactivated':
          this._eventCards.update((cards) => [
            ...cards,
            {
              kind: 'whiteboard_deactivated',
              id: `wb-off-${Date.now()}`,
              ts: Date.now(),
              activated: false,
            } satisfies EventCard,
          ]);
          break;

        case 'mod_accepted': {
          const userId = Number(event.userId);
          this.pushUserEventCard('mod_accepted', userId, 'mod', { isAccepted: true });
          break;
        }

        case 'mod_removed': {
          const userId = Number(event.userId);
          this.pushUserEventCard('mod_removed', userId, 'modr', { isAccepted: false });
          break;
        }

        case 'stage_kick': {
          const userId = Number(event.userId);
          this.pushUserEventCard('stage_kick', userId, 'stagekick', { managerName: event.managerName });
          break;
        }

        case 'room_kick': {
          const userId = Number(event.userId);
          this.activeJoinedUserIds.delete(userId);
          // Only show card for the kicked user — others see the toast + redirect from RoomPageBase
          if (userId === this._currentUserId) {
            this.pushUserEventCard('room_kick', userId, 'roomkick', {
              nickname: event.nickname,
              managerName: event.managerName,
            });
          }
          break;
        }
      }
    });
  }

  addComment(comment: Comment): void {
    this.collection.update((list) => {
      if (comment._id && list.some((c) => c._id === comment._id)) return list;
      return [...list, comment];
    });
  }

  removeComment(id: string): void {
    this.collection.update((list) => list.filter((c) => c._id !== id));
  }

  updateComments(comments: Comment[]): void {
    this.setCollection([...comments].sort((a, b) => a.createdAtMs - b.createdAtMs));
  }

  mergeComments(fresh: Comment[]): void {
    this.collection.update((existing) => {
      const existingIds = new Set(existing.map((c) => c._id));
      const newOnes = fresh.filter((c) => !existingIds.has(c._id));
      return [...existing, ...newOnes].sort((a, b) => a.createdAtMs - b.createdAtMs);
    });
  }

  updateCaptions(captions: CaptionEntry[]): void {
    this._captions.set(captions);
  }

  async loadCaptions(cname: string, busiType: number): Promise<void> {
    if (!cname) return;
    try {
      const history = await firstValueFrom(this.api.fetchCaptionHistory(cname, busiType));
      this.updateCaptions([...(history?.list ?? [])]);
    } catch {
    }
  }

  async toggleCaption(cname: string, busiType: number, enabled: boolean): Promise<void> {
    if (!cname) return;
    await firstValueFrom(this.api.toggleCaption(cname, busiType, enabled ? 1 : 2));
  }

  async refreshComments(cname: string, busiType: number, mode: 'merge' | 'replace'): Promise<void> {
    const comments = await firstValueFrom(this.api.fetchComments(cname, busiType));
    if (mode === 'merge') {
      this.mergeComments([...(comments?.items ?? [])]);
    } else {
      this.updateComments([...(comments?.items ?? [])]);
    }
  }

  override reset(): void {
    super.reset();
    this._captions.set([]);
    this._eventCards.set([]);
    this.activeJoinedUserIds.clear();
    for (const timer of this.pendingQuitTimers.values()) clearTimeout(timer);
    this.pendingQuitTimers.clear();
    this._currentUserId = 0;
  }
}
