/**
 * Map a HelloTalk room cname to its business-type identifier.
 *
 *   LS_xxx  →  1  (live / video room, navigates to /room/video/...)
 *   VR_xxx  →  2  (voice room,     navigates to /room/...)
 *   else    →  null (unknown prefix — caller should refuse the navigate)
 *
 * Single source of truth for the LS_/VR_ prefix convention, previously duplicated
 * inline in voice-list.ts and now needed by the room-presence-banner too.
 */
export type RoomBusiType = 1 | 2;

export function cnameToBusiType(cname: string): RoomBusiType | null {
  if (!cname) return null;
  if (cname.startsWith('LS_')) return 1;
  if (cname.startsWith('VR_')) return 2;
  return null;
}