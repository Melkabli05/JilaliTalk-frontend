import { InjectionToken } from '@angular/core';
import { Observable, of } from 'rxjs';

/** Abstraction so core/ can approve/decline a room invite without importing
 *  features/room/'s RoomApi directly (see CLAUDE.md §2 — core/ may not import
 *  features/). app.config.ts binds this to the real RoomApi-backed implementation,
 *  the same pattern already used for NOTIFICATION_REPORTER. */
export interface RoomInviteGateway {
  approveStageInvite(cname: string, accepted: boolean): Observable<void>;
  approveModInvite(cname: string, userId: number): Observable<void>;
}

export const ROOM_INVITE_GATEWAY = new InjectionToken<RoomInviteGateway>('ROOM_INVITE_GATEWAY', {
  factory: () => ({
    approveStageInvite: () => of(undefined), // no-op until app.config.ts binds the real RoomApi
    approveModInvite: () => of(undefined),
  }),
});
