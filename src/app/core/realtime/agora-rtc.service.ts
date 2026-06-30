import { Injectable, signal, computed } from '@angular/core';
import AgoraRTC, {
  type IAgoraRTCClient,
  type ILocalAudioTrack,
  type ILocalVideoTrack,
  type ConnectionState,
} from 'agora-rtc-sdk-ng';
import type { RtcConnectionState, RealtimeLifecycle } from './realtime-events';

export type AudioNoiseSuppressionLevel = 0 | 1 | 2 | 3;

export interface RemoteUser {
  readonly uid: number;
  readonly hasAudio: boolean;
  readonly hasVideo: boolean;
  readonly audioTrack: any | null;
  readonly videoTrack: any | null;
  readonly nickname: string;
  readonly isScreenShare: boolean;
}

@Injectable({ providedIn: 'root' })
export class AgoraRtcService implements RealtimeLifecycle {
  private client: IAgoraRTCClient | null = null;
  private micTrack: ILocalAudioTrack | null = null;
  private videoTrack: ILocalVideoTrack | null = null;
  private isGhostMode = false;

  private readonly _state = signal<RtcConnectionState>('disconnected');
  private readonly _remoteUsers = signal<readonly RemoteUser[]>([]);
  private readonly _speakingUids = signal<readonly number[]>([]);
  private readonly _localAudioTrack = signal<any | null>(null);
  private readonly _localVideoTrack = signal<any | null>(null);
  private readonly _isPublishing = signal(false);
  private readonly _isMuted = signal(false);
  private readonly _roomClosed = signal<{ reason: string } | null>(null);
  private readonly _noiseSuppressionLevel = signal<AudioNoiseSuppressionLevel>(2);
  private readonly remoteAudioTracks = new Map<number, any>();
  private autoplayArmed = false;
  private autoplayHandler: (() => void) | null = null;

  readonly state = this._state.asReadonly();
  readonly remoteUsers = this._remoteUsers.asReadonly();
  readonly speakingUids = this._speakingUids.asReadonly();
  readonly localAudioTrack = this._localAudioTrack.asReadonly();
  readonly localVideoTrack = this._localVideoTrack.asReadonly();
  readonly isPublishing = this._isPublishing.asReadonly();
  readonly isMuted = this._isMuted.asReadonly();
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

    if (isGhostMode) {
      await this.startGhostTrack();
    }
  }

  private async startGhostTrack(): Promise<void> {
    const client = this.client;
    if (!client) return;
    try {
      const track = await AgoraRTC.createMicrophoneAudioTrack(this.getAudioTrackOptions());
      track.setVolume(140);
      await client.publish(track);
      await track.setEnabled(false);
      this.micTrack = track;
      this._localAudioTrack.set(track);
      this._isPublishing.set(true);
      this._isMuted.set(true);
    } catch (err) {
      console.warn('[AgoraRtc] ghost track failed:', err);
    }
  }

  async startAudio(publisherToken?: string | null): Promise<void> {
    const client = this.client;
    if (!client) throw new Error('Not connected');

    if (!this.isGhostMode) await client.setClientRole('host');
    if (publisherToken) await client.renewToken(publisherToken);
    const track = await AgoraRTC.createMicrophoneAudioTrack(this.getAudioTrackOptions());
    track.setVolume(140);
    await client.publish(track);
    this.micTrack = track;
    this._localAudioTrack.set(track);
    this._isPublishing.set(true);
    this._isMuted.set(false);
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
    await this.client?.unpublish(this.micTrack).catch(() => {});
    this.micTrack.stop();
    this.micTrack.close();
    this.micTrack = null;
    this._localAudioTrack.set(null);
    this._isPublishing.set(false);
    this._isMuted.set(false);
    if (!this.isGhostMode) await this.client?.setClientRole('audience').catch(() => {});
  }

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
    this._isMuted.set(!enabled);
  }

  async setCamEnabled(enabled: boolean): Promise<void> {
    await this.videoTrack?.setEnabled(enabled);
  }

  async switchAudioInput(deviceId: string): Promise<void> {
    if (!this.micTrack) return;
    try {
      await (this.micTrack as any).setDevice(deviceId);
    } catch (err) {
      console.warn('[AgoraRtc] switchAudioInput failed:', err);
    }
  }

  async switchVideoInput(deviceId: string): Promise<void> {
    if (!this.videoTrack) return;
    try {
      await (this.videoTrack as any).setDevice(deviceId);
    } catch (err) {
      console.warn('[AgoraRtc] switchVideoInput failed:', err);
    }
  }

  async setSpeakerDevice(_deviceId: string): Promise<void> {}

  setNoiseSuppressionLevel(level: AudioNoiseSuppressionLevel): void {
    this._noiseSuppressionLevel.set(level);
  }

  private getAudioTrackOptions(): { AEC: boolean; AGC: boolean; ANS: boolean; encoderConfig: 'high_quality_stereo' } {
    const level = this._noiseSuppressionLevel();
    return {
      AEC: true,
      AGC: true,
      ANS: level !== 0,
      encoderConfig: 'high_quality_stereo',
    };
  }

  async disconnect(): Promise<void> {
    try {
      if (this.micTrack) {
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
      this._isPublishing.set(false);
      this._isMuted.set(false);
      this._state.set('disconnected');
      this._roomClosed.set(null);
      this.remoteAudioTracks.clear();
      if (this.autoplayHandler) {
        document.removeEventListener('click', this.autoplayHandler);
        document.removeEventListener('touchstart', this.autoplayHandler);
        document.removeEventListener('keydown', this.autoplayHandler);
        this.autoplayHandler = null;
        this.autoplayArmed = false;
      }
    }
  }

  private armAutoplayRecovery(): void {
    if (this.autoplayArmed) return;
    this.autoplayArmed = true;
    const resume = (): void => {
      for (const track of this.remoteAudioTracks.values()) {
        try { track.play(); } catch { return; }
      }
      this.autoplayArmed = false;
      this.autoplayHandler = null;
      document.removeEventListener('click', resume);
      document.removeEventListener('touchstart', resume);
      document.removeEventListener('keydown', resume);
    };
    this.autoplayHandler = resume;
    document.addEventListener('click', resume);
    document.addEventListener('touchstart', resume);
    document.addEventListener('keydown', resume);
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
      try { await client.subscribe(user, mediaType); } catch { return; }
      if (mediaType === 'audio' && user.audioTrack) {
        this.remoteAudioTracks.set(user.uid, user.audioTrack);
        try { user.audioTrack.play(); } catch { this.armAutoplayRecovery(); }
      }
      this.addRemoteUser(user, mediaType);
    });

    client.on('user-unpublished', (user: any, mediaType: 'audio' | 'video') => {
      this._remoteUsers.update((list) => list.map((u) => u.uid === user.uid
        ? {
            ...u,
            hasAudio: mediaType === 'audio' ? false : u.hasAudio,
            hasVideo: mediaType === 'video' ? false : u.hasVideo,
            audioTrack: mediaType === 'audio' ? null : u.audioTrack,
            videoTrack: mediaType === 'video' ? null : u.videoTrack,
          }
        : u,
      ));
    });

    client.on('user-joined', (user: any) => {
      this.addRemoteUser(user, 'none');
    });

    client.on('user-left', (user: any) => {
      this.remoteAudioTracks.delete(user.uid);
      this._remoteUsers.update((list) => list.filter((u) => u.uid !== user.uid));
    });

    client.on('volume-indicator', (volumes: readonly { uid: number; level: number }[]) => {
      const speaking = volumes.filter((v) => v.level > 60).map((v) => v.uid);
      this._speakingUids.set(speaking);
    });
  }

  private addRemoteUser(user: any, mediaType: 'audio' | 'video' | 'none'): void {
    const uid = user.uid;
    const isScreenShare = String(uid).startsWith('2000');
    this._remoteUsers.update((list) => {
      const existing = list.find((u) => u.uid === uid);
      if (existing) {
        return list.map((u) => u.uid === uid
          ? {
              ...u,
              hasAudio: mediaType === 'audio' ? true : u.hasAudio,
              hasVideo: mediaType === 'video' ? true : u.hasVideo,
              audioTrack: mediaType === 'audio' ? user.audioTrack : u.audioTrack,
              videoTrack: mediaType === 'video' ? user.videoTrack : u.videoTrack,
              isScreenShare: isScreenShare ? true : u.isScreenShare,
            }
          : u,
        );
      }
      return [...list, {
        uid,
        hasAudio: mediaType === 'audio',
        hasVideo: mediaType === 'video',
        audioTrack: mediaType === 'audio' ? user.audioTrack : null,
        videoTrack: mediaType === 'video' ? user.videoTrack : null,
        nickname: user.nickname ?? String(uid),
        isScreenShare,
      }];
    });
  }
}

function mapState(s: ConnectionState): RtcConnectionState {
  switch (s) {
    case 'CONNECTING': return 'connecting';
    case 'CONNECTED': return 'connected';
    case 'RECONNECTING': return 'reconnecting';
    case 'DISCONNECTED': return 'disconnected';
    case 'DISCONNECTING': return 'disconnected';
    default: return 'failed';
  }
}
