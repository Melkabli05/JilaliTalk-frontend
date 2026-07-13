import { Service, InjectionToken, Signal, signal, inject, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { Comment, CaptionEntry, CommentOrEvent, EventCard } from '../models/room-model';
import { CollectionStore } from '@shared/utils';
import { HtRoomConnectionService } from '@core/realtime/ht-room-connection.service';
import type { RoomEventSource } from '@core/realtime/room-connection-roles';
import { UserRole } from '@core/models/user-role';
import { RoomApi } from '../api/room-api';
import { EventFeedStore } from './event-feed-store';

type MergedEntry = { readonly item: CommentOrEvent; readonly ts: number };

/** Read-only surface for components that only display comments (comments-panel.ts,
 *  comment-list.ts) — narrower than the full CommentsStore so they can't reach
 *  addComment/mergeComments/reset by mistake. */
export interface CommentsReader {
  readonly comments: Signal<readonly Comment[]>;
  readonly captions: Signal<readonly CaptionEntry[]>;
  readonly eventCards: Signal<readonly EventCard[]>;
  readonly mergedItems: Signal<readonly CommentOrEvent[]>;
  readonly unreadCount: Signal<number>;
  readonly lastReadTs: Signal<number>;
}

/** Write surface for the one legitimate non-page mutation: clearing the unread
 *  pill when comment-list.ts detects the user has scrolled to the bottom. */
export interface CommentsWriter {
  resetUnread(): void;
}

export const COMMENTS_READER = new InjectionToken<CommentsReader>('COMMENTS_READER');
export const COMMENTS_WRITER = new InjectionToken<CommentsWriter>('COMMENTS_WRITER');

@Service({ autoProvided: false })
export class CommentsStore extends CollectionStore<Comment> {
  private readonly bffWs: RoomEventSource = inject(HtRoomConnectionService);
  private readonly api = inject(RoomApi);
  private readonly eventFeed = inject(EventFeedStore);

  readonly comments = this.items;

  /** Event-card feed (joins/quits/gifts/follows/hand/mod/kick/whiteboard) —
   *  owned by EventFeedStore; re-exposed here so existing consumers of
   *  CommentsStore.eventCards don't need to change. */
  readonly eventCards = this.eventFeed.eventCards;

  setCurrentUserId(uid: number): void { this.eventFeed.setCurrentUserId(uid); }

  private readonly _captions = signal<readonly CaptionEntry[]>([]);
  readonly captions = this._captions.asReadonly();

  readonly mergedItems = computed<readonly CommentOrEvent[]>(() => {
    const comments: MergedEntry[] = this.items().map((c) => ({ item: c, ts: c.createdAtMs }));
    const cards: MergedEntry[] = this.eventFeed.eventCards().map((c) => ({
      item: this.eventFeed.resolveEventCard(c),
      ts: c.ts,
    }));
    return [...comments, ...cards].sort((a, b) => a.ts - b.ts).map((e) => e.item);
  });

  // "X new messages" pill state. Increments inside addComment() for items
  // newer than _lastReadTs; resets to (Date.now(), 0) on resetUnread() or
  // reset(). Initialized at construction with Date.now() so the history
  // bundle loaded by updateComments() doesn't get counted as "new".
  private readonly _lastReadTs = signal(Date.now());
  private readonly _unreadCount = signal(0);
  readonly unreadCount = this._unreadCount.asReadonly();
  readonly lastReadTs = this._lastReadTs.asReadonly();

  resetUnread(): void {
    this._lastReadTs.set(Date.now());
    this._unreadCount.set(0);
  }

  constructor() {
    super();
    this.bffWs.event$('comment').pipe(takeUntilDestroyed()).subscribe((event) => {
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
        ...(event.comment.clientNonce ? { clientNonce: event.comment.clientNonce } : {}),
      });
    });
  }

  addComment(comment: Comment): void {
    this.collection.update((list) => {
      if (comment.clientNonce) {
        const idx = list.findIndex((c) => c.clientNonce === comment.clientNonce);
        if (idx >= 0) {
          const next = list.slice();
          next[idx] = comment;
          return next;
        }
      }
      if (comment._id && list.some((c) => c._id === comment._id)) return list;

      // Fallback reconciliation for when the BFF doesn't echo clientNonce back on the
      // realtime event (see CommentEvent.clientNonce) — this is not a rare edge case,
      // it's the *only* path that ever runs: BffSendCommentRequest.java (the POST
      // /comments body) has no clientNonce field at all, so the backend can never echo
      // one back. The optimistic local insert (id "local-...") is matched against the
      // real server comment by same user + sent within the last 15s — deliberately NOT
      // exact text equality too: the live WS comment push has been observed carrying no
      // msg id, and requiring the text to match byte-for-byte as well made this match
      // fail (and silently leave both rows in the list, duplicated) on any server-side
      // text normalization. A user's own comments arrive back in the order sent, so
      // matching the oldest still-pending local placeholder for that user is enough on
      // its own, and list.findIndex()'s natural array order already gives FIFO pairing
      // for the rare case of two rapid sends.
      if (!comment._id.startsWith('local-')) {
        const idx = list.findIndex(
          (c) =>
            c._id.startsWith('local-') &&
            c.userId === comment.userId &&
            Math.abs(c.createdAtMs - comment.createdAtMs) < 15_000,
        );
        if (idx >= 0) {
          const next = list.slice();
          next[idx] = comment;
          return next;
        }
      }

      return [...list, comment];
    });
    if (comment.createdAtMs > this._lastReadTs()) {
      this._unreadCount.update((n) => n + 1);
    }
  }

  removeComment(id: string): void {
    this.collection.update((list) => list.filter((c) => c._id !== id));
  }

  /** Called once POST /comments confirms a send — patches the optimistic local placeholder's
   *  timestamp to the BFF's own exact send instant, replacing the frontend's Date.now() guess.
   *  Deliberately does NOT touch `_id` (stays "local-..."): the WS echo that eventually arrives
   *  for this comment still needs addComment's fallback match (same user + time window) to find
   *  and replace this row, since the echo carries no id of its own — this just makes that match
   *  precise instead of racing the round-trip latency between send and echo. */
  confirmCommentSent(localId: string, createdAtMs: number): void {
    this.collection.update((list) =>
      list.map((c) => (c._id === localId ? { ...c, createdAtMs, updatedAtMs: createdAtMs } : c)),
    );
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
    this.eventFeed.reset();
    this._lastReadTs.set(Date.now());
    this._unreadCount.set(0);
  }
}
