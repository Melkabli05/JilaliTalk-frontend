import type { Observable } from 'rxjs';
import type { RoomRealtimeEvent } from './room-realtime-events';

/**
 * Narrow role interface `HtRoomConnectionService` satisfies structurally — the room feature's
 * read-only consumers (roster/comments/event-feed stores, the room facade) only ever filter
 * `event$()`; they never connect, disconnect, or read connection status. Typing them against
 * this interface instead of the concrete service keeps that boundary explicit (ISP) without
 * introducing a DI token for every role — `HtRoomConnectionService` stays a single concrete
 * class, this is a consumer-side view type.
 */
export interface RoomEventSource {
  event$<T extends RoomRealtimeEvent['type']>(
    type: T,
  ): Observable<Extract<RoomRealtimeEvent, { type: T }>>;
}
