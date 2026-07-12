import type {
  CommentEvent,
  GiftEvent,
  ReplyInfoEvent,
  RoomRealtimeEvent,
  StageUserEvent,
} from '../room-realtime-events';

/**
 * Maps a decoded LiveHub notify envelope (`{ notify_type, notify_info }`) to the frontend's
 * `RoomRealtimeEvent` union. Field-mapping rules are ported from jilalibff's
 * `HtNotifyMapper.java`, which encodes the same kind of traffic-verified JSON semantics the
 * IM event mapper preserves from `HtImNotifyMapper.java` — a different source of truth than
 * the wire/framing layer (which comes from the reference client, `scriptv2.js`'s
 * `fireRoomWebSocket`), but the right one for exact field names and edge cases like the
 * gift-batch-vs-user-join disambiguation on notify_type "1".
 */

const TYPES_REQUIRING_USER_ID = new Set([
  '2', '8', '9', '10', '11', '18', '23', '29', '30', '34', '35', '40', '48',
]);

function textOr(obj: Record<string, unknown>, field: string, fallback: string): string {
  const v = obj[field];
  return typeof v === 'string' && v.length > 0 ? v : fallback;
}

function textOrNull(obj: Record<string, unknown>, field: string): string | null {
  const v = obj[field];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function numOr(obj: Record<string, unknown>, field: string, fallback: number): number {
  const v = obj[field];
  return typeof v === 'number' ? v : fallback;
}

function boolOr(obj: Record<string, unknown>, field: string, fallback: boolean): boolean {
  const v = obj[field];
  return typeof v === 'boolean' ? v : fallback;
}

function userId(info: Record<string, unknown>): string {
  return textOr(info, 'user_id', '');
}

function cname(info: Record<string, unknown>): string {
  return textOr(info, 'cname', '');
}

function requiresUserId(notifyType: string, info: Record<string, unknown>): boolean {
  if (TYPES_REQUIRING_USER_ID.has(notifyType)) {
    return numOr(info, 'user_id', 0) === 0;
  }
  if (notifyType === '1') {
    const users = info['users'];
    const isGiftBatch = numOr(info, 'type', -1) === 1 && Array.isArray(users) && users.length > 0;
    if (isGiftBatch) {
      const first = (users as unknown[])[0];
      if (typeof first !== 'object' || first === null) return true;
      return numOr(first as Record<string, unknown>, 'send_uid', 0) === 0;
    }
    return numOr(info, 'user_id', 0) === 0;
  }
  return false;
}

function mapStageUser(info: Record<string, unknown>): StageUserEvent {
  return {
    userId: textOr(info, 'user_id', ''),
    nickname: textOrNull(info, 'nickname'),
    headUrl: textOrNull(info, 'head_url'),
  };
}

function mapGift(userNode: Record<string, unknown>, info: Record<string, unknown>): GiftEvent {
  return {
    sendUid: textOr(userNode, 'send_uid', ''),
    sendNickname: textOr(userNode, 'send_nickname', ''),
    sendHeadUrl: textOrNull(userNode, 'send_head_url'),
    sendNation: textOrNull(userNode, 'send_nation'),
    receiverUid: textOr(userNode, 'receiver_uid', ''),
    receiverNickname: textOr(userNode, 'receiver_nickname', ''),
    receiverHeadUrl: textOrNull(userNode, 'receiver_head_url'),
    receiverNation: textOrNull(userNode, 'receiver_nation'),
    smallPic: textOrNull(userNode, 'small_pic'),
    giftId: numOr(userNode, 'gift_id', 0),
    giftNumber: numOr(userNode, 'gift_number', 1),
    giftVal: numOr(userNode, 'gift_val', 0),
    vipType: numOr(info, 'vip_type', 0),
    giftLevel: numOr(info, 'gift_level', 0),
    dayRankLevel: numOr(info, 'day_rank_level', 0),
  };
}

function mapGiftBatch(info: Record<string, unknown>): RoomRealtimeEvent | null {
  const users = info['users'];
  if (numOr(info, 'type', -1) !== 1 || !Array.isArray(users)) return null;
  const gifts = (users as unknown[])
    .filter((u): u is Record<string, unknown> => typeof u === 'object' && u !== null)
    .map((u) => mapGift(u, info));
  return gifts.length === 0 ? null : { type: 'gift', gifts };
}

function mapTypeOne(info: Record<string, unknown>): RoomRealtimeEvent {
  const gifts = mapGiftBatch(info);
  if (gifts) return gifts;
  const isBannedComment = boolOr(info, 'is_banned_comment', false);
  return {
    type: 'user_join',
    userId: userId(info),
    nickname: textOr(info, 'nickname', textOr(info, 'send_nickname', 'Someone')),
    headUrl: textOrNull(info, 'head_url'),
    nationality: textOrNull(info, 'nationality'),
    isBannedComment,
  };
}

function mapLuckyBag(info: Record<string, unknown>): RoomRealtimeEvent {
  return {
    type: 'lucky_bag',
    luckyBagId: textOr(info, 'lucky_bag_id', ''),
    luckyBagNumber: numOr(info, 'lucky_bag_number', 0),
    cname: cname(info),
  };
}

function luckyBagOrNull(info: Record<string, unknown>): RoomRealtimeEvent | null {
  return 'lucky_bag_id' in info ? mapLuckyBag(info) : null;
}

function mapTypeThree(notifyType: string, info: Record<string, unknown>, root: Record<string, unknown>): RoomRealtimeEvent {
  if ('lucky_bag_id' in info) return mapLuckyBag(info);
  const gameType = numOr(info, 'game_type', -1);
  const kickType = numOr(info, 'kick_type', -1);
  if (gameType === 2) return { type: 'whiteboard_activated', cname: cname(info) };
  if (gameType === 0) return { type: 'whiteboard_deactivated', cname: cname(info) };
  if (kickType === 1) {
    return {
      type: 'room_kick',
      userId: userId(info),
      nickname: textOr(info, 'nickname', ''),
      managerName: textOr(info, 'manager_name', ''),
      cname: cname(info),
    };
  }
  if (kickType === 2) return { type: 'user_quit', userId: userId(info) };
  return { type: 'raw', originalType: notifyType, payload: root };
}

function mapReply(replyNode: unknown): ReplyInfoEvent | null {
  if (typeof replyNode !== 'object' || replyNode === null) return null;
  const r = replyNode as Record<string, unknown>;
  return {
    msgId: textOr(r, 'msg_id', ''),
    fromId: numOr(r, 'from_id', 0),
    fromNickname: textOr(r, 'from_nickname', ''),
    text: textOr(r, 'text', ''),
    msgType: textOr(r, 'msg_type', 'text'),
  };
}

function mapComment(info: Record<string, unknown>): CommentEvent {
  const msg = (info['msg'] as Record<string, unknown> | undefined) ?? {};
  const textNode = msg['text'];
  const text = typeof textNode === 'object' && textNode !== null
    ? textOr(textNode as Record<string, unknown>, 'text', '')
    : typeof textNode === 'string'
      ? textNode
      : '';

  const id = textOr(info, '_id', textOr(msg, 'msg_id', ''));
  const createdAt = info['created_at'];
  const ts = typeof createdAt === 'number' ? createdAt * 1000 : Date.now();

  return {
    id,
    userId: userId(info),
    nickname: textOr(info, 'nickname', 'Anonymous'),
    headUrl: textOr(info, 'head_url', ''),
    text,
    ts,
    replyInfo: mapReply(msg['reply_info']),
    nationality: textOrNull(info, 'nationality'),
    role: numOr(info, 'role', 3),
    vipType: numOr(info, 'vip_type', 0),
    dayRankLevel: numOr(info, 'day_rank_level', 0),
    giftLevel: numOr(info, 'gift_level', 0),
    fgLevel: numOr(info, 'fg_level', 0),
    fgName: textOr(info, 'fg_name', ''),
    fgIsActive: boolOr(info, 'fg_is_active', false),
    bubbleId: numOr(info, 'bubble_id', -1),
    bubbleUrl: textOrNull(info, 'bubble_url'),
    bubbleColor: textOr(info, 'bubble_color', '#ffffff'),
    hitBad: numOr(info, 'hit_bad', 0),
    bubbleAnimalType: numOr(info, 'bubble_animal_type', 0),
    bubbleAnimalUrl: textOrNull(info, 'bubble_animal_url'),
  };
}

/** Maps one notify envelope to a RoomRealtimeEvent, or null when the frame is silently dropped
 *  (a user-id-requiring type arriving with user_id 0 — a malformed-upstream guard, not a real
 *  event to surface). Never throws; a mapping failure that would otherwise throw is the
 *  caller's job to catch and turn into an `error` event, matching how HtNotifyMapper.java
 *  wraps `mapEvent` in a try/catch at its call site rather than inside each case. */
export function mapRoomNotifyToEvent(
  notifyType: string,
  info: Record<string, unknown>,
  root: Record<string, unknown>,
): RoomRealtimeEvent | null {
  if (requiresUserId(notifyType, info)) return null;

  switch (notifyType) {
    case '1':
      return mapTypeOne(info);
    case '2':
      return { type: 'user_quit', userId: userId(info) };
    case '3':
      return mapTypeThree(notifyType, info, root);
    case '4':
      return luckyBagOrNull(info) ?? { type: 'stage_join', stageUser: mapStageUser(info) };
    case '5': {
      const luckyBag = luckyBagOrNull(info);
      if (luckyBag) return luckyBag;
      return 'coin' in info ? null : { type: 'stage_quit', userId: userId(info) };
    }
    case '6':
      return luckyBagOrNull(info);
    case '8':
      return { type: 'mic_opened', userId: userId(info) };
    case '9':
      return { type: 'mic_closed', userId: userId(info) };
    case '10':
      return { type: 'stage_raisehand', userId: userId(info), raisehandType: 1 };
    case '11':
      return { type: 'stage_raisehand', userId: userId(info), raisehandType: 2 };
    case '18':
      return { type: 'stage_invite', userId: userId(info) };
    case '23':
      return { type: 'stage_join', stageUser: mapStageUser(info) };
    case '25':
      return { type: 'comment', comment: mapComment(info) };
    case '29':
      return { type: 'stage_kick', userId: userId(info), managerName: textOr(info, 'manager_name', ''), cname: cname(info) };
    case '30':
      return { type: 'stage_device_control', userId: userId(info), deviceType: 1, switchType: 1 };
    case '34':
      return { type: 'mod_accepted', userId: userId(info) };
    case '35':
      return { type: 'mod_removed', userId: userId(info) };
    case '40':
      return { type: 'mod_unmuted', userId: userId(info) };
    case '48':
      return { type: 'mod_invite', userId: userId(info) };
    case '53':
      return {
        type: 'follow',
        userId: userId(info),
        nickname: textOr(info, 'nickname', ''),
        headUrl: textOrNull(info, 'head_url'),
        status: numOr(info, 'status', 0),
      };
    default:
      return { type: 'raw', originalType: notifyType, payload: root };
  }
}
