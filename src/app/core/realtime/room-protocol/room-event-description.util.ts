import type { RoomRealtimeEvent } from '../room-realtime-events';

/**
 * Human-readable log formatting for the LiveHub room protocol — kept separate from
 * `HtRoomConnectionService` so that service's job stays "manage the connection," not "know
 * how to render every event as a log line." Only used for dev-mode console output.
 */
export function describeRoomEvent(event: RoomRealtimeEvent): string {
  switch (event.type) {
    case 'connection-state':
      return `connection state: ${event.state}`;
    case 'user_join':
      return `${event.nickname} joined`;
    case 'user_quit':
      return `user ${event.userId} quit`;
    case 'stage_join':
      return `${event.stageUser.nickname ?? event.stageUser.userId} joined stage`;
    case 'stage_quit':
      return `user ${event.userId} left stage`;
    case 'stage_raisehand':
      return `user ${event.userId} ${event.raisehandType === 1 ? 'raised hand' : 'lowered hand'}`;
    case 'stage_invite':
      return `stage invite for user ${event.userId}`;
    case 'comment':
      return `comment from ${event.comment.nickname}: "${event.comment.text}"`;
    case 'gift':
      return `gift batch, ${event.gifts.length} gift(s)`;
    case 'stage_device_control':
      return `device control for user ${event.userId} (device ${event.deviceType}, switch ${event.switchType})`;
    case 'mod_invite':
      return `mod invite for user ${event.userId}`;
    case 'whiteboard_activated':
      return `whiteboard activated in ${event.cname}`;
    case 'whiteboard_deactivated':
      return `whiteboard deactivated in ${event.cname}`;
    case 'mic_opened':
      return `user ${event.userId} opened mic`;
    case 'mic_closed':
      return `user ${event.userId} closed mic`;
    case 'mod_unmuted':
      return `user ${event.userId} unmuted`;
    case 'room_kick':
      return `${event.nickname} kicked from room by ${event.managerName}`;
    case 'stage_kick':
      return `user ${event.userId} kicked from stage by ${event.managerName}`;
    case 'mod_accepted':
      return `user ${event.userId} accepted mod`;
    case 'mod_removed':
      return `user ${event.userId} removed as mod`;
    case 'follow':
      return `${event.nickname} followed (status ${event.status})`;
    case 'lucky_bag':
      return `lucky bag ${event.luckyBagId} in ${event.cname}`;
    case 'raw':
      return `unrecognized notify_type ${event.originalType}`;
    case 'error':
      return `error: ${event.message}`;
  }
}
