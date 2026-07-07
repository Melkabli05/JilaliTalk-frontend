import { Injectable, InjectionToken, Signal, signal, inject, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { Comment, CaptionEntry, CommentOrEvent, EventCard } from '../../data/room-model';
import { CollectionStore } from '@shared/utils';
import { BffRoomSocketService } from '@core/realtime/bff-room-socket.service';
import { UserRole } from '@core/models/user-role';
import { RoomApi } from '../../data/room-api';
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

@Injectable()
export class CommentsStore extends CollectionStore<Comment> {
  private readonly bffWs = inject(BffRoomSocketService);
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
      return [...list, comment];
    });
    if (comment.createdAtMs > this._lastReadTs()) {
      this._unreadCount.update((n) => n + 1);
    }
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
    this.eventFeed.reset();
    this._lastReadTs.set(Date.now());
    this._unreadCount.set(0);
  }
}
