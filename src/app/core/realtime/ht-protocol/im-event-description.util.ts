import type { ImEvent } from '../im-events';
import {
  CMD_HEARTBEAT,
  CMD_HEARTBEAT_ACK,
  CMD_LOGIN,
  CMD_MSG_ACK,
  CMD_OFFLINE_SYNC_RESPONSE,
  CMD_OFFLINE_SYNC_TRIGGER_FIRST,
  CMD_OFFLINE_SYNC_TRIGGER_PAGE,
  CMD_PRIVATE_MSG,
  CMD_READ_RECEIPT,
  CMD_TYPING_INDICATOR,
  FLAG_ACK,
  FLAG_CLIENT_REQUEST,
  FLAG_PUSH,
  FLAG_SERVER_RESPONSE,
  FLAG_TYPING,
} from './packet-framer.util';

/**
 * Human-readable log formatting for the IM protocol — kept separate from
 * `HtImConnectionService` so that service's job stays "manage the connection," not "know how
 * to render every cmdId/flag/event as a log line." Only used for dev-mode console output.
 */

const CMD_NAMES: Record<number, string> = {
  [CMD_LOGIN]: 'LOGIN',
  [CMD_HEARTBEAT]: 'HEARTBEAT',
  [CMD_HEARTBEAT_ACK]: 'HEARTBEAT_ACK',
  [CMD_PRIVATE_MSG]: 'PRIVATE_MSG',
  [CMD_MSG_ACK]: 'MSG_ACK',
  [CMD_READ_RECEIPT]: 'READ_RECEIPT',
  [CMD_TYPING_INDICATOR]: 'TYPING_INDICATOR',
  [CMD_OFFLINE_SYNC_TRIGGER_FIRST]: 'OFFLINE_SYNC_TRIGGER_FIRST',
  [CMD_OFFLINE_SYNC_TRIGGER_PAGE]: 'OFFLINE_SYNC_TRIGGER_PAGE',
  [CMD_OFFLINE_SYNC_RESPONSE]: 'OFFLINE_SYNC_RESPONSE',
};

const FLAG_NAMES: Record<number, string> = {
  [FLAG_CLIENT_REQUEST]: 'CLIENT_REQUEST',
  [FLAG_PUSH]: 'PUSH',
  [FLAG_ACK]: 'ACK',
  [FLAG_TYPING]: 'TYPING',
  [FLAG_SERVER_RESPONSE]: 'SERVER_RESPONSE',
};

export function describeCmd(cmdId: number): string {
  return CMD_NAMES[cmdId] ?? `cmd ${cmdId}`;
}

export function describeFlag(flag: number): string {
  return FLAG_NAMES[flag] ?? `flag 0x${flag.toString(16)}`;
}

export function describeImEvent(event: ImEvent): string {
  switch (event.type) {
    case 'text_message':
      return `text message from ${event.fromNickname || event.fromUserId}: "${event.text}"`;
    case 'image_message':
      return `image message from ${event.fromNickname || event.fromUserId}`;
    case 'gift_message':
      return `gift x${event.count} from ${event.fromNickname || event.fromUserId}`;
    case 'introduction_message':
      return `introduction from ${event.fromNickname || event.fromUserId}`;
    case 'voice_room_shared':
      return `voice room shared by ${event.fromNickname}: ${event.cname}`;
    case 'live_room_shared':
      return `live room shared by ${event.fromNickname}: ${event.cname}`;
    case 'group_message':
      return `group message in ${event.roomName} from ${event.senderName}: ${event.text}`;
    case 'typing_indicator':
      return `${event.fromUserId} ${event.isTyping ? 'is typing' : 'stopped typing'}`;
    case 'read_receipt':
      return `read receipt for msgId ${event.msgId}`;
    case 'message_ack':
      return `delivered msgId ${event.msgId}`;
    case 'follow':
      return `${event.nickname} followed you (status ${event.status})`;
    case 'profile_visit':
      return `profile visit from ${event.nickname ?? event.visitorUserId}`;
    case 'stage_invite':
      return `stage invite from ${event.userId} in ${event.cname}`;
    case 'mod_invite':
      return `mod invite from ${event.userId} in ${event.cname}`;
    case 'mod_accepted':
      return `${event.userId} accepted mod`;
    case 'mod_removed':
      return `${event.userId} removed as mod`;
    case 'mod_unmuted':
      return `${event.userId} unmuted`;
    case 'account_status':
      return `account status: ${event.status}`;
    case 'error':
      return `error: ${event.message}`;
    case 'connection-state':
      return `connection state: ${event.state}`;
  }
}
