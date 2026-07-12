import type { RtmInboundMessage, RtmOutboundMessage } from './realtime-events';

export interface RtmTypingSignal {
  readonly channel: string;
  readonly fromUid: string;
  readonly sender: string;
  readonly ts: number;
}

export type RtmParsedEvent =
  | { readonly kind: 'typing'; readonly signal: RtmTypingSignal }
  | { readonly kind: 'message'; readonly message: RtmInboundMessage };

interface RawRtmMessageEvent {
  readonly message: string | ArrayBuffer | unknown;
  readonly channelName: string;
  readonly publisher: string;
}

/**
 * Decodes a raw Agora RTM message-event payload (string/ArrayBuffer/other) into our typed
 * wire shape and discriminates a typing signal from a chat message — split out of
 * `AgoraRtmService` so the parsing/discrimination logic is testable independent of the RTM
 * client wiring, matching the pattern already used for the IM/Room WebSocket frame parsers.
 */
export function parseRtmMessageEvent(e: RawRtmMessageEvent): RtmParsedEvent {
  const raw =
    typeof e.message === 'string'
      ? e.message
      : e.message instanceof ArrayBuffer
        ? new TextDecoder().decode(e.message)
        : String(e.message);

  let parsed: RtmOutboundMessage | null = null;
  try {
    parsed = JSON.parse(raw) as RtmOutboundMessage;
  } catch {
    // not JSON — treated as a plain-text chat message below
  }

  const fromUid = String(e.publisher);

  if (parsed?.kind === 'typing') {
    return {
      kind: 'typing',
      signal: { channel: e.channelName, fromUid, sender: parsed.sender, ts: Date.now() },
    };
  }

  return {
    kind: 'message',
    message: {
      channel: e.channelName,
      fromUid,
      text: parsed?.kind === 'chat' ? parsed.text : raw,
      ts: Date.now(),
      payload: parsed,
    },
  };
}
