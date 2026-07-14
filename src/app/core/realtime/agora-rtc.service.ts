import { Injectable, signal, computed } from '@angular/core';
import AgoraRTC, {
  type IAgoraRTCClient,
  type ILocalAudioTrack,
  type ILocalVideoTrack,
  type ConnectionState,
} from 'agora-rtc-sdk-ng';
import type { RtcConnectionState, RealtimeLifecycle } from './realtime-events';
import { AgoraDenoiserController } from './agora-denoiser-controller';
import { AutoplayAudioRecovery } from './autoplay-audio-recovery';
import {
  clearRemoteUserMedia,
  removeRemoteUser,
  upsertRemoteUser,
  type RemoteUser,
} from './remote-user-roster.util';

export type { RemoteUser } from './remote-user-roster.util';
export type AudioNoiseSuppressionLevel = 0 | 1 | 2 | 3;

@Injectable({ providedIn: 'root' })
export class AgoraRtcService implements RealtimeLifecycle {
  private client: IAgoraRTCClient | null = null;
  private micTrack: ILocalAudioTrack | null = null;
  private videoTrack: ILocalVideoTrack | null = null;
  private isGhostMode = false;
  private readonly denoiser = new AgoraDenoiserController();
  private readonly autoplayRecovery = new AutoplayAudioRecovery(() => this.remoteAudioTracks.values());

  constructor() {
    this.denoiser.onDegraded = (reason) => this.onDenoiserDegraded?.(reason);
  }

  private readonly _state = signal<RtcConnectionState>('disconnected');
  private readonly _remoteUsers = signal<readonly RemoteUser[]>([]);
  private readonly _speakingUids = signal<readonly number[]>([]);
  private readonly _localAudioTrack = signal<any | null>(null);
  private readonly _localVideoTrack = signal<any | null>(null);
  private readonly _roomClosed = signal<{ reason: string } | null>(null);
  private readonly _noiseSuppressionLevel = signal<AudioNoiseSuppressionLevel>(2);
  private readonly remoteAudioTracks = new Map<number, any>();

  readonly state = this._state.asReadonly();
  readonly remoteUsers = this._remoteUsers.asReadonly();
  readonly speakingUids = this._speakingUids.asReadonly();
  readonly localAudioTrack = this._localAudioTrack.asReadonly();
  readonly localVideoTrack = this._localVideoTrack.asReadonly();
  readonly isConnected = computed(() => this._state() === 'connected');
  readonly roomClosed = this._roomClosed.asReadonly();
  readonly noiseSuppressionLevel = this._noiseSuppressionLevel.asReadonly();

  async connect(
    channel: string,
    uid: number,
    token: string | null,
    appId: string,
    isGhostMode = false,
  ): Promise<void> {
    if (this.client) await this.disconnect();

    this.isGhostMode = isGhostMode;
    this._state.set('connecting');

    const client = AgoraRTC.createClient({
      mode: isGhostMode ? 'rtc' : 'live',
      codec: 'vp8',
    });
    this.client = client;
    this.wireCallbacks(client);
    client.enableAudioVolumeIndicator();

    if (!isGhostMode) {
      await client.setClientRole('host');
    }

    await client.join(appId, channel, token, uid === 0 ? null : uid);
    this._state.set('connected');
  }

  async startAudio(publisherToken?: string | null): Promise<void> {
    const client = this.client;
    if (!client) throw new Error('Not connected');

    if (!this.isGhostMode) await client.setClientRole('host');
    if (publisherToken) await client.renewToken(publisherToken);
    const track = await AgoraRTC.createMicrophoneAudioTrack(this.getAudioTrackOptions());
    track.setVolume(100);
    await this.denoiser.attach(track, this._noiseSuppressionLevel());
    await client.publish(track);
    this.micTrack = track;
    this._localAudioTrack.set(track);
  }

  async startVideo(publisherToken?: string | null): Promise<void> {
    const client = this.client;
    if (!client) throw new Error('Not connected');
    if (!this.isGhostMode) await client.setClientRole('host');
    if (publisherToken) await client.renewToken(publisherToken);
    const track = await AgoraRTC.createCameraVideoTrack({ encoderConfig: '720p_1' });
    await client.publish(track);
    this.videoTrack = track;
    this._localVideoTrack.set(track);
  }

  async stopAudio(): Promise<void> {
    if (!this.micTrack) return;
    await this.denoiser.detach();
    await this.client?.unpublish(this.micTrack).catch(() => {});
    this.micTrack.stop();
    this.micTrack.close();
    this.micTrack = null;
    this._localAudioTrack.set(null);
    if (!this.isGhostMode) await this.client?.setClientRole('audience').catch(() => {});
  }

  /** Optional callback the room UI can hook to surface a "mic degraded — AI denoiser offline"
   *  badge when the denoiser overloads or the pipe fails. Called on every degraded event;
   *  the consumer is responsible for de-bouncing / clearing the badge when its own healthy-state
   *  check resolves it. */
  onDenoiserDegraded: ((reason: 'overload' | 'pipe-error') => void) | null = null;

  async stopVideo(): Promise<void> {
    if (!this.videoTrack) return;
    await this.client?.unpublish(this.videoTrack).catch(() => {});
    this.videoTrack.stop();
    this.videoTrack.close();
    this.videoTrack = null;
    this._localVideoTrack.set(null);
  }

  async setMicEnabled(enabled: boolean): Promise<void> {
    await this.micTrack?.setEnabled(enabled);
  }

  async setCamEnabled(enabled: boolean): Promise<void> {
    await this.videoTrack?.setEnabled(enabled);
  }

  setNoiseSuppressionLevel(level: AudioNoiseSuppressionLevel): void {
    this._noiseSuppressionLevel.set(level);
    // Live-apply if a track is already publishing — matches the AI denoiser being the one
    // actually doing noise suppression today (see getAudioTrackOptions); native ANS can't be
    // changed on an existing track anyway, so there'd be nothing to do for that case here.
    void this.denoiser.applyLevel(level);
  }

  private getAudioTrackOptions(): {
    AEC: boolean;
    AGC: boolean;
    ANS: boolean;
    encoderConfig: 'speech_standard';
  } {
    // The AI denoiser (attached right after this track is created — see startAudio) and
    // native ANS both suppress noise on the same signal; running both in series was producing
    // audible artifacts for listeners, not cleaner audio. Native ANS now only covers browsers
    // the AI denoiser can't run in at all — isSupported() is checked here, before track
    // creation, specifically so that fallback decision is made up front rather than only
    // discovered after attach() runs on an already-created track.
    return {
      AEC: true,
      AGC: true,
      ANS: !this.denoiser.isSupported(),
      // speech_standard (32kHz mono, 24Kbps) is Agora's recommended profile for
      // voice-chat call quality/smooth transmission under real network conditions —
      // music_standard (48kHz, 32Kbps, tuned for high-fidelity/no-quality-change-on-
      // device-switch) is the wrong tool for a multi-participant voice room and is
      // more prone to artifacts under jitter/packet loss.
      encoderConfig: 'speech_standard',
    };
  }

  async disconnect(): Promise<void> {
    try {
      if (this.micTrack) {
        await this.denoiser.detach();
        await this.client?.unpublish(this.micTrack).catch(() => {});
        this.micTrack.stop();
        this.micTrack.close();
      }
      if (this.videoTrack) {
        await this.client?.unpublish(this.videoTrack).catch(() => {});
        this.videoTrack.stop();
        this.videoTrack.close();
      }
      await this.client?.leave().catch(() => {});
    } finally {
      this.client = null;
      this.micTrack = null;
      this.videoTrack = null;
      this._remoteUsers.set([]);
      this._localAudioTrack.set(null);
      this._localVideoTrack.set(null);
      this._state.set('disconnected');
      this._roomClosed.set(null);
      this.remoteAudioTracks.clear();
      this.autoplayRecovery.disarm();
    }
  }

  private wireCallbacks(client: IAgoraRTCClient): void {
    client.on('connection-state-change', (cur: ConnectionState, _prev: string, reason: string) => {
      this._state.set(mapState(cur));
      if (cur === 'DISCONNECTED') {
        const reject = ['SERVER_REJECTED', 'CHANNEL_EXPIRED', 'IP_BANNED', 'UID_BANNED'];
        if (reject.includes(reason)) this._roomClosed.set({ reason });
      }
    });

    client.on('user-published', async (user: any, mediaType: 'audio' | 'video') => {
      try {
        await client.subscribe(user, mediaType);
      } catch {
        return;
      }
      if (mediaType === 'audio' && user.audioTrack) {
        this.remoteAudioTracks.set(user.uid, user.audioTrack);
        try {
          user.audioTrack.play();
        } catch {
          this.autoplayRecovery.arm();
        }
      }
      this._remoteUsers.update((list) => upsertRemoteUser(list, user, mediaType));
    });

    client.on('user-unpublished', (user: any, mediaType: 'audio' | 'video') => {
      this._remoteUsers.update((list) => clearRemoteUserMedia(list, user.uid, mediaType));
    });

    client.on('user-joined', (user: any) => {
      this._remoteUsers.update((list) => upsertRemoteUser(list, user, 'none'));
    });

    client.on('user-left', (user: any) => {
      this.remoteAudioTracks.delete(user.uid);
      this._remoteUsers.update((list) => removeRemoteUser(list, user.uid));
    });

    client.on('volume-indicator', (volumes: readonly { uid: number; level: number }[]) => {
      const speaking = volumes.filter((v) => v.level > 60).map((v) => v.uid);
      this._speakingUids.set(speaking);
    });
  }
}

function mapState(s: ConnectionState): RtcConnectionState {
  switch (s) {
    case 'CONNECTING':
      return 'connecting';
    case 'CONNECTED':
      return 'connected';
    case 'RECONNECTING':
      return 'reconnecting';
    case 'DISCONNECTED':
      return 'disconnected';
    case 'DISCONNECTING':
      return 'disconnected';
    default:
      return 'failed';
  }
}
