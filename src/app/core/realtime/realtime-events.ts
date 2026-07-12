export type RtcConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed';

export interface RealtimeLifecycle {
  readonly isConnected: () => boolean;
  disconnect(): Promise<void>;
}

export interface RtmInboundMessage {
  channel: string;
  fromUid: string;
  text: string;
  ts: number;
  payload: RtmOutboundMessage | null;
}

export type RtmOutboundMessage =
  | { kind: 'chat'; uid: string; sender: string; avatar: string; text: string; ts: number }
  | { kind: 'typing'; uid: string; sender: string; ts: number };
