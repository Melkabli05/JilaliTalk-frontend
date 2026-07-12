import type { Signal } from '@angular/core';
import type { DmSendPayload } from './ht-protocol/packet-framer.util';
import type { ImEvent } from './im-events';

/**
 * Narrow role interfaces `HtImConnectionService` satisfies structurally — split by what a
 * consumer actually needs (ISP), so e.g. a store that only sends messages isn't typed with
 * `connect`/`disconnect` it will never call. `HtImConnectionService` itself stays a single
 * concrete class; these are consumer-side view types, not a new DI layer.
 */

export interface ImEventSource {
  readonly events: Signal<readonly ImEvent[]>;
}

export interface ImConnectionController {
  connect(): void;
  disconnect(): void;
}

export interface ImMessageSender {
  sendDm(
    peerId: number,
    payload: DmSendPayload,
    fromNickname: string,
    fromProfileTs: number,
    msgId?: string,
  ): string | null;
  sendTyping(peerId: number, isTyping: boolean): void;
  sendReadReceipt(peerId: number, msgId: string): void;
}
