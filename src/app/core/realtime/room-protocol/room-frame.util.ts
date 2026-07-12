/**
 * LiveHub room WebSocket framing: plain JSON text frames, ported from the reference client's
 * `fireRoomWebSocket()` (scriptv2.js). No binary header, no encryption, no login handshake —
 * connect via query params only, then init/heartbeat/ack.
 */

export function buildInitFrame(userId: number, cname: string): string {
  return JSON.stringify({ user_id: userId, cname, action: 1 });
}

export function buildHeartbeatFrame(userId: number, cname: string, isVisitor: boolean): string {
  return JSON.stringify({ cname, user_id: userId, action: 2, is_visitor: isVisitor });
}

export function buildAckFrame(userId: number, cname: string, isVisitor: boolean, msgId: string): string {
  return JSON.stringify({ msg_id: msgId, action: 3, user_id: userId, cname, is_visitor: isVisitor });
}

export interface RoomNotifyEnvelope {
  readonly notifyType: string;
  readonly info: Record<string, unknown>;
  readonly root: Record<string, unknown>;
}

/** Parses one inbound frame into whichever of the three shapes it is: a heartbeat-interval
 *  announcement, a heartbeat ack, or a notify envelope (`{ event: { notify_type, notify_info } }`).
 *  Mirrors the reference client's `data.heartbeat_sec` / `data.heartbeat_time` / `data.event`
 *  dispatch exactly, including checking `heartbeat_sec`/`heartbeat_time` before treating
 *  anything else as a notify frame. */
export type RoomFrame =
  | { readonly kind: 'heartbeat_interval'; readonly heartbeatSec: number }
  | { readonly kind: 'heartbeat_ack' }
  | { readonly kind: 'notify'; readonly envelope: RoomNotifyEnvelope; readonly msgId: string | null }
  | { readonly kind: 'unrecognized' };

export function parseRoomFrame(text: string): RoomFrame | null {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }

  const heartbeatSec = data['heartbeat_sec'];
  if (typeof heartbeatSec === 'number') {
    return { kind: 'heartbeat_interval', heartbeatSec };
  }
  if (data['heartbeat_time'] !== undefined) {
    return { kind: 'heartbeat_ack' };
  }

  const eventNode = data['event'];
  if (eventNode && typeof eventNode === 'object') {
    const event = eventNode as Record<string, unknown>;
    const notifyType = String(event['notify_type'] ?? '');
    const info = (event['notify_info'] as Record<string, unknown> | undefined) ?? {};
    const msgId = data['msg_id'];
    return {
      kind: 'notify',
      envelope: { notifyType, info, root: data },
      msgId: typeof msgId === 'string' ? msgId : null,
    };
  }

  const msgId = data['msg_id'];
  if (typeof msgId === 'string') {
    return { kind: 'notify', envelope: { notifyType: '', info: {}, root: data }, msgId };
  }

  return { kind: 'unrecognized' };
}
