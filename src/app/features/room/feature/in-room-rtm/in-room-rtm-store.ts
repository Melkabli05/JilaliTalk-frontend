import { Injectable, InjectionToken, Signal, inject, signal, effect, untracked } from '@angular/core';
import { RoomConnectionService } from '@core/realtime/room-connection.service';
import { CollectionStore } from '@shared/utils/collection-store';

export interface RtmMessageData {
  readonly text?: string;
  readonly uid?: string;
  readonly sender?: string;
  readonly avatar?: string;
  readonly ts?: number;
}

export interface RtmMessage {
  readonly id: string;
  readonly uid: number;
  readonly nickname: string;
  readonly avatar: string;
  readonly content: string;
  readonly timestamp: number;
  readonly isOwn: boolean;
}

/** No narrower consumer currently injects InRoomRtmStore than room-page-base.ts —
 *  see the note on StageReader/StageWriter above; same rationale applies here. */
export interface InRoomRtmReader {
  readonly messages: Signal<readonly RtmMessage[]>;
  readonly unreadCount: Signal<number>;
  readonly currentUid: Signal<number>;
}

export interface InRoomRtmWriter {
  setCurrentUid(uid: number): void;
  addMessage(msg: RtmMessage): void;
  clearUnread(): void;
  incrementUnread(): void;
  reset(): void;
}

export const IN_ROOM_RTM_READER = new InjectionToken<InRoomRtmReader>('IN_ROOM_RTM_READER');
export const IN_ROOM_RTM_WRITER = new InjectionToken<InRoomRtmWriter>('IN_ROOM_RTM_WRITER');

@Injectable()
export class InRoomRtmStore extends CollectionStore<RtmMessage> {
  readonly messages = this.items;
  readonly unreadCount = signal(0);
  readonly currentUid = signal(0);

  setCurrentUid(uid: number): void {
    this.currentUid.set(uid);
  }

  private readonly room = inject(RoomConnectionService);

  constructor() {
    super();
    effect(() => {
      const data = this.room.rtmMessage();
      if (data) untracked(() => this.handleRtmMessage(data));
    });
  }

  private handleRtmMessage(data: RtmMessageData): void {
    if (!data.text) return;

    const isOwn = data.uid === String(this.currentUid());
    this.addMessage({
      id: `rtm-${data.ts}-${Math.random()}`,
      uid: Number(data.uid) || 0,
      nickname: data.sender ?? 'Anonymous',
      avatar: data.avatar ?? '',
      content: data.text,
      timestamp: data.ts ?? Date.now(),
      isOwn,
    });
  }

  addMessage(msg: RtmMessage): void {
    this.collection.update((list) => [...list, msg]);
  }

  clearUnread(): void {
    this.unreadCount.set(0);
  }

  incrementUnread(): void {
    this.unreadCount.update((n) => n + 1);
  }

  override reset(): void {
    super.reset();
    this.unreadCount.set(0);
    this.currentUid.set(0);
  }
}
