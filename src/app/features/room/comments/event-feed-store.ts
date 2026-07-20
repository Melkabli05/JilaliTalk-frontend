import { Service, signal, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EventCard } from '../models/room-model';
import { EnrichBatchQueue } from '@shared/utils';
import { HtRoomConnectionService } from '@core/realtime/ht-room-connection.service';
import type { RoomEventSource } from '@core/realtime/room-connection-roles';
import { UserInfoService } from '@core/services/user-info.service';
import type { GiftEvent } from '@core/realtime/room-realtime-events';

const ACTIVE_USERS_TTL_MS = 5 * 60 * 1000; // 5 min — prune stale active user entries

const GIFT_COMBO_WINDOW_MS = 5_000;

/** Milestones a gift-wish card fires on, in ascending order — a milestone is only ever
 *  shown once per giftId even if the count later regresses (e.g. the wish resets). */
const GIFT_WISH_MILESTONES = [25, 50, 75, 100] as const;

const QUIT_GRACE_MS = 4_000;

/**
 * Owns the room activity feed — join/quit/gift/follow/hand/mod/kick/
 * whiteboard event cards — separated out of CommentsStore (which owns
 * comments + captions). Extracted as a pure move: same BFF event
 * handling, same card-building logic, same timers, just relocated so
 * CommentsStore isn't a catch-all for every BFF event type.
 */
@Service({ autoProvided: false })
export class EventFeedStore {
  private readonly bffWs: RoomEventSource = inject(HtRoomConnectionService);
  private readonly userInfoService = inject(UserInfoService);

  private _currentUserId = 0;
  setCurrentUserId(uid: number): void { this._currentUserId = uid; }

  private readonly _eventCards = signal<readonly EventCard[]>([]);
  readonly eventCards = this._eventCards.asReadonly();

  private readonly activeJoinedUserIds = new Map<number, number>(); // uid → lastSeen ts
  private readonly pendingQuitTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private readonly knownIdentities = new Map<
    number,
    { nickname: string; headUrl: string | null; nationality: string | null }
  >();
  private readonly enrichQueue = new EnrichBatchQueue((uids) =>
    this.userInfoService.enrichBatchAndCache(uids).then(() => undefined),
  );
  /** Highest gift-wish milestone already shown, per giftId — a wish's progress ticks
   *  continuously, so this prevents re-showing 25% every time another gift lands. */
  private readonly giftWishMilestonesShown = new Map<number, number>();

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
    const known = this.knownIdentities.get(userId);
    this._eventCards.update((cards) => [
      ...cards,
      {
        kind,
        id: `${idPrefix}-${userId}-${Date.now()}`,
        ts: Date.now(),
        userId,
        nickname: known?.nickname ?? '',
        headUrl: known?.headUrl ?? null,
        nationality: known?.nationality ?? null,
        ...extra,
      } as EventCard,
    ]);
    this.enrichQueue.queue(userId);
  }

  /** Backfills nickname/headUrl/nationality from the cached UserInfoService for cards that
   *  arrived with partial data via {@link pushUserEventCard}. Follow cards carry `userId` for
   *  click-to-profile but never `nationality` (the BFF's follow event doesn't include it) and
   *  always arrive fully enriched — so they're excluded from this async-backfill path. */
  resolveEventCard(card: EventCard): EventCard {
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
    const known = this.knownIdentities.get(userId);
    this.knownIdentities.delete(userId);
    const timer = setTimeout(() => {
      this.pendingQuitTimers.delete(userId);
      this._eventCards.update((cards) => [
        ...cards,
        {
          kind: 'user_quit',
          id: `quit-${originalEventUserId}-${Date.now()}`,
          ts: Date.now(),
          userId,
          nickname: known?.nickname ?? '',
          headUrl: known?.headUrl ?? null,
          nationality: known?.nationality ?? null,
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

  private rememberIdentity(
    userId: number,
    nickname: string | null,
    headUrl: string | null,
    nationality: string | null,
  ): void {
    if (!nickname) return;
    const existing = this.knownIdentities.get(userId);
    this.knownIdentities.set(userId, {
      nickname,
      headUrl: headUrl ?? existing?.headUrl ?? null,
      nationality: nationality ?? existing?.nationality ?? null,
    });
  }

  constructor() {
    this.bffWs.event$('gift').pipe(takeUntilDestroyed()).subscribe((event) => {
      for (const g of event.gifts) {
        this.rememberIdentity(Number(g.sendUid), g.sendNickname, g.sendHeadUrl, g.sendNation);
        this.rememberIdentity(Number(g.receiverUid), g.receiverNickname, g.receiverHeadUrl, g.receiverNation);
        this.addOrComboGift(g);
      }
    });

    this.bffWs.event$('follow').pipe(takeUntilDestroyed()).subscribe((event) => {
      this.rememberIdentity(Number(event.userId), event.nickname, event.headUrl, null);
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
    });

    this.bffWs.event$('comment').pipe(takeUntilDestroyed()).subscribe((event) => {
      this.rememberIdentity(
        Number(event.comment.userId),
        event.comment.nickname,
        event.comment.headUrl,
        event.comment.nationality,
      );
    });

    this.bffWs.event$('user_join').pipe(takeUntilDestroyed()).subscribe((event) => {
      this.pruneActiveUsers();
      const userId = Number(event.userId);
      this.rememberIdentity(userId, event.nickname, event.headUrl, event.nationality);
      if (this.cancelPendingQuit(userId)) {
        this.activeJoinedUserIds.set(userId, Date.now());
        return;
      }
      if (this.activeJoinedUserIds.has(userId)) return;
      this.activeJoinedUserIds.set(userId, Date.now());
      this.pushUserEventCard('user_join', userId, 'join', {
        nickname: event.nickname,
        headUrl: event.headUrl,
        nationality: event.nationality,
      });
    });

    this.bffWs.event$('user_quit').pipe(takeUntilDestroyed()).subscribe((event) => {
      this.pruneActiveUsers();
      const userId = Number(event.userId);
      this.activeJoinedUserIds.delete(userId);
      this.scheduleQuitCard(userId, event.userId);
      this.enrichQueue.queue(userId);
    });

    this.bffWs.event$('stage_join').pipe(takeUntilDestroyed()).subscribe((event) => {
      this.rememberIdentity(
        Number(event.stageUser.userId),
        event.stageUser.nickname,
        event.stageUser.headUrl,
        null,
      );
    });

    this.bffWs.event$('stage_raisehand').pipe(takeUntilDestroyed()).subscribe((event) => {
      const userId = Number(event.userId);
      this.pushUserEventCard('stage_raisehand', userId, 'hand', { isRaised: event.raisehandType === 1 });
    });

    this.bffWs.event$('whiteboard_activated').pipe(takeUntilDestroyed()).subscribe(() => {
      this._eventCards.update((cards) => [
        ...cards,
        {
          kind: 'whiteboard_activated',
          id: `wb-on-${Date.now()}`,
          ts: Date.now(),
          activated: true,
        } satisfies EventCard,
      ]);
    });

    this.bffWs.event$('whiteboard_deactivated').pipe(takeUntilDestroyed()).subscribe(() => {
      this._eventCards.update((cards) => [
        ...cards,
        {
          kind: 'whiteboard_deactivated',
          id: `wb-off-${Date.now()}`,
          ts: Date.now(),
          activated: false,
        } satisfies EventCard,
      ]);
    });

    this.bffWs.event$('mod_accepted').pipe(takeUntilDestroyed()).subscribe((event) => {
      const userId = Number(event.userId);
      this.pushUserEventCard('mod_accepted', userId, 'mod', { isAccepted: true });
    });

    this.bffWs.event$('mod_removed').pipe(takeUntilDestroyed()).subscribe((event) => {
      const userId = Number(event.userId);
      this.pushUserEventCard('mod_removed', userId, 'modr', { isAccepted: false });
    });

    this.bffWs.event$('stage_kick').pipe(takeUntilDestroyed()).subscribe((event) => {
      const userId = Number(event.userId);
      this.pushUserEventCard('stage_kick', userId, 'stagekick', { managerName: event.managerName });
    });

    this.bffWs.event$('room_kick').pipe(takeUntilDestroyed()).subscribe((event) => {
      const userId = Number(event.userId);
      this.activeJoinedUserIds.delete(userId);
      // Only show card for the kicked user — others see the toast + redirect from RoomFacade
      if (userId === this._currentUserId) {
        this.rememberIdentity(userId, event.nickname, null, null);
        this.pushUserEventCard('room_kick', userId, 'roomkick', { managerName: event.managerName });
      }
    });

    // Room-wide, no single user attached — always shown to everyone.
    this.bffWs.event$('room_topic_share').pipe(takeUntilDestroyed()).subscribe((event) => {
      this._eventCards.update((cards) => [
        ...cards,
        {
          kind: 'room_topic_share',
          id: `topic-${event.topicId}-${Date.now()}`,
          ts: Date.now(),
          categoryId: event.categoryId,
          topicId: event.topicId,
          name: event.name,
        } satisfies EventCard,
      ]);
    });

    // Skip self — a user doesn't need a card telling them they changed their own bubble.
    this.bffWs.event$('room_props_applied').pipe(takeUntilDestroyed()).subscribe((event) => {
      const userId = Number(event.userId);
      if (userId === this._currentUserId) return;
      const known = this.knownIdentities.get(userId);
      this._eventCards.update((cards) => [
        ...cards,
        {
          kind: 'room_props_applied',
          id: `props-${userId}-${Date.now()}`,
          ts: Date.now(),
          userId,
          nickname: known?.nickname ?? '',
          headUrl: known?.headUrl ?? null,
          nationality: known?.nationality ?? null,
          animalUrlV2: event.animalUrlV2,
          backgroundPaid: event.backgroundPaid,
        } satisfies EventCard,
      ]);
      this.enrichQueue.queue(userId);
    });

    this.bffWs.event$('purchase_vip').pipe(takeUntilDestroyed()).subscribe((event) => {
      this._eventCards.update((cards) => [
        ...cards,
        {
          kind: 'purchase_vip',
          id: `vip-${event.sendUid}-${Date.now()}`,
          ts: Date.now(),
          sendUid: event.sendUid,
          title: event.title,
          smallPic: event.smallPic,
        } satisfies EventCard,
      ]);
    });

    this.bffWs.event$('receive_vip_gifts').pipe(takeUntilDestroyed()).subscribe((event) => {
      this._eventCards.update((cards) => [
        ...cards,
        {
          kind: 'receive_vip_gifts',
          id: `vipgift-${event.sendUserId}-${Date.now()}`,
          ts: Date.now(),
          sendUserId: event.sendUserId,
          sendNickName: event.sendNickName,
        } satisfies EventCard,
      ]);
    });

    // Self-only celebration — the FG tier-up toast already covers other users' rooms via
    // the notification panel; the event card is just the in-room sparkle moment for the
    // person who leveled up.
    this.bffWs.event$('fg_upgrade_award').pipe(takeUntilDestroyed()).subscribe((event) => {
      this._eventCards.update((cards) => [
        ...cards,
        {
          kind: 'fg_upgrade_award',
          id: `fg-${event.id}-${Date.now()}`,
          ts: Date.now(),
          content: event.content,
          icon: event.icon,
        } satisfies EventCard,
      ]);
    });

    // Progress ticks continuously as gifts land, so we only surface a card the first time
    // the wish crosses a new milestone (25/50/75/100%) — not on every underlying tick.
    this.bffWs.event$('gift_wish').pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event.configGiftCount <= 0) return;
      const pct = (event.receivedGiftCount / event.configGiftCount) * 100;
      const alreadyShown = this.giftWishMilestonesShown.get(event.giftId) ?? 0;
      const crossed = GIFT_WISH_MILESTONES.filter((m) => m > alreadyShown && pct >= m);
      const milestone = crossed[crossed.length - 1];
      if (milestone === undefined) return;
      this.giftWishMilestonesShown.set(event.giftId, milestone);
      this._eventCards.update((cards) => [
        ...cards,
        {
          kind: 'gift_wish',
          id: `wish-${event.giftId}-${milestone}`,
          ts: Date.now(),
          smallPic: event.smallPic,
          receivedGiftCount: event.receivedGiftCount,
          configGiftCount: event.configGiftCount,
          milestone,
        } satisfies EventCard,
      ]);
    });
  }

  reset(): void {
    this._eventCards.set([]);
    this.activeJoinedUserIds.clear();
    for (const timer of this.pendingQuitTimers.values()) clearTimeout(timer);
    this.pendingQuitTimers.clear();
    this.knownIdentities.clear();
    this.giftWishMilestonesShown.clear();
    this._currentUserId = 0;
    this.enrichQueue.dispose();
  }
}
