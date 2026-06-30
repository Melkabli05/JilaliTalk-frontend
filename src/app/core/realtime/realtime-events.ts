export type RtcConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed';

export interface RemoteAudioUser {
  readonly uid: number;
  readonly hasAudio: boolean;
  readonly level: number;
}

export type RealtimeEvent =
  | { source: 'rtc'; type: 'connection-state'; state: RtcConnectionState }
  | { source: 'rtc'; type: 'user-published'; uid: number; kind: 'audio' | 'video' }
  | { source: 'rtc'; type: 'user-unpublished'; uid: number; kind: 'audio' | 'video' }
  | { source: 'rtc'; type: 'user-left'; uid: number }
  | { source: 'rtc'; type: 'volume'; users: RemoteAudioUser[] }
  | { source: 'rtm'; type: 'message'; channel: string; fromUid: number; text: string }
  | { source: 'rtm'; type: 'typing'; channel: string; fromUid: number };

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
