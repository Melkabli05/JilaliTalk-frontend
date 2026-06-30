import { Injectable, signal, computed, inject } from '@angular/core';
import { environment } from '@env/environment';
import { AgoraRtcService } from './agora-rtc.service';
import { AgoraRtmService } from './agora-rtm.service';

export type RoomPhase = 'idle' | 'joining' | 'joined' | 'leaving';

@Injectable({ providedIn: 'root' })
export class RoomConnectionService {
  private readonly rtc = inject(AgoraRtcService);
  private readonly rtm = inject(AgoraRtmService);

  private readonly _phase = signal<RoomPhase>('idle');
  readonly phase = this._phase.asReadonly();
  readonly isJoined = computed(() => this._phase() === 'joined');

  async connect(channel: string, uid: number, token: string | null, appId: string, isGhostMode = false): Promise<void> {
    this._phase.set('joining');
    await this.rtc.connect(channel, uid, token, appId, isGhostMode);
    this._phase.set('joined');
  }

  async startAudio(t?: string | null): Promise<void> { await this.rtc.startAudio(t); }
  async startVideo(t?: string | null): Promise<void> { await this.rtc.startVideo(t); }
  async stopAudio(): Promise<void> { await this.rtc.stopAudio(); }
  async stopVideo(): Promise<void> { await this.rtc.stopVideo(); }
  async setMicEnabled(v: boolean): Promise<void> { await this.rtc.setMicEnabled(v); }
  async setCamEnabled(v: boolean): Promise<void> { await this.rtc.setCamEnabled(v); }

  async connectRtm(uid: number): Promise<void> {
    await this.rtm.login(environment.agoraAppIdRtm, String(uid));
  }
  async subscribeRtmChannel(ch: string): Promise<void> { await this.rtm.subscribe(ch); }
  async sendRtmMessage(uid: number, ch: string, text: string, nick = 'Anonymous', avatar = ''): Promise<void> {
    await this.rtm.publish(ch, JSON.stringify({ kind: 'chat', uid: String(uid), sender: nick, avatar, text, ts: Date.now() }));
  }
  sendRtmTyping(uid: number, ch: string, nick = 'Anonymous'): void {
    this.rtm.publishTyping(ch, String(uid), nick);
  }
  async disconnectRtm(): Promise<void> { await this.rtm.disconnect(); }

  readonly agora = this.rtc;
  get roomClosed() { return this.rtc.roomClosed(); }
  get remoteUsers() { return this.rtc.remoteUsers(); }
  readonly localAudioTrack = this.rtc.localAudioTrack;
  readonly localVideoTrack = this.rtc.localVideoTrack;
  get isConnected() { return this.rtc.isConnected(); }
  get isPublishing() { return this.rtc.isPublishing(); }
  get isMuted() { return this.rtc.isMuted(); }
  readonly speakingUids = computed(() => this.rtc.speakingUids());
  readonly rtmMessage = this.rtm.lastMessage;
  readonly rtmTyping = this.rtm.lastTyping;

  async leave(): Promise<void> {
    if (this._phase() === 'idle') return;
    this._phase.set('leaving');
    await this.rtc.disconnect();
    await this.rtm.disconnect();
    this._phase.set('idle');
  }
}
