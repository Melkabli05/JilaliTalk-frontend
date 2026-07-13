import type { ImEvent } from '../im-events';

/**
 * Maps a decoded JSON push payload from the personal ht_im/sock channel (msg_type-tagged DMs
 * and notify_type-tagged account notifications) to the frontend's ImEvent union.
 *
 * Field-mapping rules are ported from jilalibff's `HtImNotifyMapper.java`, which was built
 * and refined against live traffic captures (see that file's inline comments for the exact
 * captured payload shapes each rule handles — e.g. the `new_voice_visitor` self-echo drop).
 * That's a different kind of "source of truth" than the framing/crypto layer above this file:
 * this is the JSON semantic layer, independently reverse-engineered from real traffic and
 * worth preserving as-is rather than re-deriving with less information.
 *
 * Out of scope (return null / unreached): msg_type "send_gift" has no inbound mapping (it's
 * outbound-only — inbound gifts arrive as msg_type "gift"); notify_type "10"/"11" (room
 * audience raise/cancel-hand) and cmdId 29968 (RTM group sync) are room-feature concerns,
 * excluded per the private-messaging-only scope.
 */

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

function objOrNull(obj: Record<string, unknown>, field: string): Record<string, unknown> | null {
  const v = obj[field];
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function nullableText(obj: Record<string, unknown>, field: string): string | null {
  const v = obj[field];
  return typeof v === 'string' ? v : null;
}

function nullableNum(obj: Record<string, unknown>, field: string): number | null {
  const v = obj[field];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function mapImJsonToEvent(
  json: Record<string, unknown>,
  headerFromId: number,
  selfUserId: number,
): ImEvent | null {
  const msgType = json['msg_type'];
  if (typeof msgType === 'string') {
    switch (msgType) {
      case 'text':
        return mapText(json, headerFromId);
      case 'image':
        return mapImage(json, headerFromId);
      case 'gift':
        return mapGift(json, headerFromId);
      case 'introduction':
        return mapIntroduction(json, headerFromId);
      case 'new_voice_visitor':
        return mapProfileVisit(json, headerFromId, selfUserId);
      default:
        return null;
    }
  }
  if (json['notify_type'] !== undefined) return mapNotify(json, headerFromId, selfUserId);
  return null;
}

function mapText(json: Record<string, unknown>, headerFromId: number): ImEvent {
  const fromUserId = textOr(json, 'from_id', String(headerFromId));
  const fromNickname = textOr(json, 'from_nickname', textOr(json, 'nickname', ''));
  const fromHeadUrl = textOrNull(json, 'from_head_url');
  const t = json['text'];
  const text =
    typeof t === 'object' && t !== null
      ? textOr(t as Record<string, unknown>, 'text', '')
      : typeof t === 'string'
        ? t
        : '';
  const ts = numOr(json, 'ts', Date.now());
  return {
    type: 'text_message',
    fromUserId,
    fromNickname,
    text,
    ts,
    ...(fromHeadUrl !== null ? { fromHeadUrl } : {}),
  };
}

function mapImage(json: Record<string, unknown>, headerFromId: number): ImEvent {
  const fromUserId = textOr(json, 'from_id', String(headerFromId));
  const fromNickname = textOr(json, 'from_nickname', textOr(json, 'nickname', ''));
  const fromHeadUrl = textOrNull(json, 'from_head_url');
  const image = json['image'];
  let imageUrl = typeof image === 'object' && image !== null ? textOr(image as Record<string, unknown>, 'url', '') : '';
  if (!imageUrl) imageUrl = textOr(json, 'image_url', '');
  const ts = numOr(json, 'ts', Date.now());
  return {
    type: 'image_message',
    fromUserId,
    fromNickname,
    imageUrl,
    ts,
    ...(fromHeadUrl !== null ? { fromHeadUrl } : {}),
  };
}

function mapGift(json: Record<string, unknown>, headerFromId: number): ImEvent {
  const fromUserId = textOr(json, 'from_id', String(headerFromId));
  const fromNickname = textOr(json, 'from_nickname', textOr(json, 'nickname', ''));
  const fromHeadUrl = textOrNull(json, 'from_head_url') ?? textOrNull(json, 'head_url');
  const giftId = numOr(json, 'gift_id', 0);
  const count = numOr(json, 'gift_number', 1);
  return {
    type: 'gift_message',
    fromUserId,
    fromNickname,
    giftId,
    count,
    ...(fromHeadUrl !== null ? { fromHeadUrl } : {}),
  };
}

function mapIntroduction(json: Record<string, unknown>, headerFromId: number): ImEvent | null {
  const fromUserId = textOr(json, 'from_id', String(headerFromId));
  const fromNickname = textOr(json, 'from_nickname', textOr(json, 'nickname', ''));
  const fromHeadUrl = textOrNull(json, 'from_head_url') ?? textOrNull(json, 'head_url');

  const intro = objOrNull(json, 'introduction');
  if (!intro) return null;
  const targetUserId = textOr(intro, 'user_id', '');
  if (!targetUserId) return null;
  const targetNickname = textOr(intro, 'nickname', '');
  const targetHeadUrl = nullableText(intro, 'head_url');
  const targetSex = nullableText(intro, 'sex');
  const targetAge = nullableNum(intro, 'age');
  const targetNationality = nullableText(intro, 'nationality');
  const targetBio = nullableText(intro, 'bio');

  return {
    type: 'introduction_message',
    fromUserId,
    fromNickname,
    ...(fromHeadUrl !== null ? { fromHeadUrl } : {}),
    targetUserId,
    targetNickname,
    targetHeadUrl,
    targetSex,
    targetAge,
    targetNationality,
    targetBio,
  };
}

function mapNotify(json: Record<string, unknown>, headerFromId: number, selfUserId: number): ImEvent | null {
  if (typeof json['cname'] === 'string') {
    const cname = json['cname'];
    const fromUserId = textOr(json, 'from_id', String(headerFromId));
    const fromNickname = textOr(json, 'from_nickname', textOr(json, 'nickname', ''));
    const headUrl = textOrNull(json, 'head_url');
    if ('count' in json || 'voice_count' in json) {
      const count = 'count' in json ? numOr(json, 'count', 0) : numOr(json, 'voice_count', 0);
      return { type: 'voice_room_shared', fromUserId, fromNickname, cname, headUrl, count };
    }
    return { type: 'live_room_shared', fromUserId, fromNickname, cname, headUrl };
  }

  const info = (json['notify_info'] as Record<string, unknown> | undefined) ?? {};
  const selfId = String(selfUserId);
  const notifyType = String(json['notify_type'] ?? '');

  switch (notifyType) {
    case '18':
      return { type: 'stage_invite', userId: textOr(info, 'user_id', selfId), cname: textOr(info, 'cname', '') };
    case '48':
      return { type: 'mod_invite', userId: textOr(info, 'user_id', selfId), cname: textOr(info, 'cname', '') };
    case '34':
      return { type: 'mod_accepted', userId: textOr(info, 'user_id', selfId) };
    case '35':
      return { type: 'mod_removed', userId: textOr(info, 'user_id', selfId) };
    case '40':
      return { type: 'mod_unmuted', userId: textOr(info, 'user_id', selfId) };
    case '53': {
      const headUrl = textOrNull(info, 'head_url');
      return {
        type: 'follow',
        userId: textOr(info, 'user_id', ''),
        nickname: textOr(info, 'nickname', ''),
        status: numOr(info, 'status', 0),
        ...(headUrl !== null ? { headUrl } : {}),
      };
    }
    default:
      break;
  }

  for (const field of ['visitor_uid', 'visitor_user_id', 'visitor_id']) {
    const visitorId = textOrNull(json, field);
    if (!visitorId || visitorId === selfId) continue;
    const nickname = textOr(json, 'nickname', textOr(json, 'from_nickname', ''));
    const headUrl = textOrNull(json, 'head_url') ?? textOrNull(json, 'headUrl');
    return {
      type: 'profile_visit',
      visitorUserId: visitorId,
      nickname,
      ...(headUrl !== null ? { headUrl } : {}),
    };
  }
  return null;
}

/**
 * Live capture (see HtImNotifyMapper.java) revealed that `userId` names whose profile the
 * event is about while `visitor_id` names who actually did the visiting — an account viewing
 * its own room echoes this push back with `visitor_id` resolving to self, which must be
 * dropped rather than surfaced as "you visited your own profile."
 */
function mapProfileVisit(json: Record<string, unknown>, headerFromId: number, selfUserId: number): ImEvent | null {
  let visitorId = textOrNull(json, 'visitor_id') ?? textOrNull(json, 'visitor_uid');
  if (!visitorId) {
    visitorId =
      headerFromId > 0 && headerFromId !== selfUserId
        ? String(headerFromId)
        : textOrNull(json, 'userId') ?? textOrNull(json, 'user_id');
  }
  if (!visitorId || visitorId === String(selfUserId)) return null;
  const nickname = textOr(json, 'nickname', textOr(json, 'from_nickname', ''));
  const headUrl = textOrNull(json, 'head_url') ?? textOrNull(json, 'headUrl');
  return {
    type: 'profile_visit',
    visitorUserId: visitorId,
    nickname,
    ...(headUrl !== null ? { headUrl } : {}),
  };
}
