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
  /**
   * Captured at connect() time so enablePublishing() can tear down the current
   * session and reconnect in the opposite mode ('rtc' ↔ 'live') for a real
   * mid-session promotion. agora-rtc-sdk-ng@4.24.4 has no ChannelMediaOptions /
   * updateChannelMediaOptions API, so role-flipping on a live connection is not
   * possible — a full reconnect is the only way.
   */
  private connectedChannel: string | null = null;
  private connectedUid: number | null = null;
  private connectedAppId: string | null = null;
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
  private readonly _publishing = signal<boolean>(false);
  private readonly remoteAudioTracks = new Map<number, any>();

  readonly state = this._state.asReadonly();
  readonly remoteUsers = this._remoteUsers.asReadonly();
  readonly speakingUids = this._speakingUids.asReadonly();
  readonly localAudioTrack = this._localAudioTrack.asReadonly();
  readonly localVideoTrack = this._localVideoTrack.asReadonly();
  readonly isConnected = computed(() => this._state() === 'connected');
  readonly roomClosed = this._roomClosed.asReadonly();
  readonly noiseSuppressionLevel = this._noiseSuppressionLevel.asReadonly();
  /** True when the local user is currently publishing audio to the room — either on-stage
   *  or as an audience/ghost speaker. Drives mic-state UI without callers having to inspect
   *  tracks or session state. */
  readonly isPublishing = this._publishing.asReadonly();

  async connect(
    channel: string,
    uid: number,
    token: string | null,
    appId: string,
    isGhostMode = false,
  ): Promise<void> {
    if (this.client) await this.disconnect();

    this.isGhostMode = isGhostMode;
    this.connectedChannel = channel;
    this.connectedUid = uid;
    this.connectedAppId = appId;
    this._state.set('connecting');

    const client = AgoraRTC.createClient({
      mode: isGhostMode ? 'rtc' : 'live',
      codec: 'vp8',
    });
    this.client = client;
    this.wireCallbacks(client);
    client.enableAudioVolumeIndicator();

    // In 'live' mode the SDK requires setClientRole('host') before joinChannel.
    // In 'rtc' mode (used for invisible 'ghost' users) the SDK has no role concept
    // at all — every joined client is a peer with the same capabilities. Invisible
    // users can therefore subscribe to the room audio but cannot publish, until
    // enablePublishing(true) tears down the 'rtc' session and rejoins in 'live'
    // mode as host. That mid-session reconnect IS the promotion mechanism in this
    // SDK version — agora-rtc-sdk-ng@4.24.4 does not expose ChannelMediaOptions or
    // updateChannelMediaOptions, so role flips on a live connection are not possible.
    if (!isGhostMode) {
      await client.setClientRole('host');
    }

    await client.join(appId, channel, token, uid === 0 ? null : uid);
    this._state.set('connected');
    // After a fresh join the user has not yet enabled mic publishing — mirror the
    // role state into the publishing signal so callers see a consistent 'muted'.
    this._publishing.set(false);
  }

  async enablePublishing(enabled: boolean): Promise<void> {
    if (!this.connectedChannel || this.connectedUid === null || !this.connectedAppId) return;

    // Three cases:
    //   (a) already in the target mode → no-op, just mirror the signal
    //   (b) visible user wanting to publish → no-op, already host from connect()
    //   (c) invisible user wanting to publish → mid-session promotion by tearing
    //       down the 'rtc' audience session and reconnecting in 'live' mode as host
    //   (d) ghost speaker wanting to stop → mid-session demotion by tearing down
    //       the 'live' host session and reconnecting in 'rtc' mode as audience
    // Case (a) handles the visible/no-state-change path; case (b) is the same.
    const targetGhostMode = !enabled;
    if (targetGhostMode === this.isGhostMode) {
      this._publishing.set(enabled);
      return;
    }

    // Stop any in-flight mic track before reconnecting — otherwise the reconnect
    // races against the unpublish and the SDK throws on duplicate-track errors.
    if (this.micTrack) {
      await this.denoiser.detach();
      await this.client?.unpublish(this.micTrack).catch(() => {});
      this.micTrack.stop();
      this.micTrack.close();
      this.micTrack = null;
      this._localAudioTrack.set(null);
    }

    // Tear down the existing client + wire callbacks; reuse the captured connect
    // params for the new session. Pass null as the token so the SDK uses the
    // cached one if the upstream still considers us authenticated (publishers
    // for invisible users DO NOT need a fresh publisher token — they get a normal
    // token from the join bundle; publisher tokens are only required when joining
    // explicitly via the on-stage publisher-token endpoint).
    await this.client?.leave().catch(() => {});
    this.client = null;
    this._remoteUsers.set([]);
    this._speakingUids.set([]);
    this.remoteAudioTracks.clear();

    this.isGhostMode = targetGhostMode;
    this._state.set('connecting');

    const client = AgoraRTC.createClient({
      mode: targetGhostMode ? 'rtc' : 'live',
      codec: 'vp8',
    });
    this.client = client;
    this.wireCallbacks(client);
    client.enableAudioVolumeIndicator();
    if (!targetGhostMode) {
      await client.setClientRole('host');
    }
    await client.join(
      this.connectedAppId,
      this.connectedChannel,
      null,
      this.connectedUid === 0 ? null : this.connectedUid,
    );
    this._state.set('connected');
    this._publishing.set(enabled);
  }

  async startAudio(publisherToken?: string | null): Promise<void> {
    const client = this.client;
    if (!client) throw new Error('Not connected');

    // Caller is responsible for enablePublishing(true) if the session was started as
    // audience (invisible or off-stage understage). startAudio no longer flips the role
    // itself — that contract belongs to enablePublishing, which is also what callers
    // pair with stopAudio to demote back.
    if (publisherToken) await client.renewToken(publisherToken);
    const track = await AgoraRTC.createMicrophoneAudioTrack(this.getAudioTrackOptions());
    track.setVolume(100);
    await this.denoiser.attach(track, this._noiseSuppressionLevel());
    await client.publish(track);
    this.micTrack = track;
    this._localAudioTrack.set(track);
    this._publishing.set(true);
  }

  async startVideo(publisherToken?: string | null): Promise<void> {
    const client = this.client;
    if (!client) throw new Error('Not connected');
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
    // Note: a caller that needs to demote from 'host' → 'audience' (or back from
    // 'live' → 'rtc' for invisible users) should call enablePublishing(false),
    // which performs the full disconnect/reconnect cycle. stopAudio alone only
    // tears down the local track — the RTC role state is unchanged.
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
      this.connectedChannel = null;
      this.connectedUid = null;
      this.connectedAppId = null;
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
