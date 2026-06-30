import { signal } from '@angular/core';
import { AudioProcessor, type IProcessorContext, type IAudioProcessorContext } from 'agora-rte-extension';

declare const Jungle: new (ctx: AudioContext) => {
  input: AudioNode;
  output: AudioNode;
  setPitchOffset(semitones: number): void;
};

export class JungleReverbProcessor extends AudioProcessor {
  private ctx: AudioContext | null = null;
  private jungle: { input: AudioNode; output: AudioNode; setPitchOffset(s: number): void } | null = null;
  private reverbNode: ConvolverNode | null = null;
  private reverbSend: GainNode | null = null;
  private dryGain: GainNode | null = null;

  readonly name = 'JungleReverbProcessor';

  private readonly _pitch = signal(1.0);
  private readonly _reverbOn = signal(false);

  readonly pitch = this._pitch.asReadonly();
  readonly reverbOn = this._reverbOn.asReadonly();

  override get kind(): 'audio' { return 'audio'; }

  override async onNode(audioNode: AudioNode, context: IProcessorContext): Promise<void> {
    const agoraCtx = (context as unknown as IAudioProcessorContext).getAudioContext();
    this.ctx = agoraCtx;

    this.dryGain = agoraCtx.createGain();
    this.dryGain.gain.value = 1;

    this.jungle = new Jungle(agoraCtx);

    this.reverbNode = agoraCtx.createConvolver();
    this.reverbNode.buffer = this.buildImpulseResponse(agoraCtx, 1.5, 0.8);

    this.reverbSend = agoraCtx.createGain();
    this.reverbSend.gain.value = this._reverbOn() ? 0.4 : 0;

    const outputGain = agoraCtx.createGain();
    outputGain.gain.value = 1;

    audioNode.connect(this.dryGain);
    this.dryGain.connect(this.jungle.input);
    this.jungle.output.connect(outputGain);

    if (this._reverbOn()) {
      this.jungle.output.connect(this.reverbSend);
      this.reverbSend.connect(this.reverbNode);
      this.reverbNode.connect(outputGain);
    }

    this.setPitchOffset(this._pitch());

    this.output(outputGain, context as unknown as IAudioProcessorContext);
  }

  private buildImpulseResponse(ctx: AudioContext, duration: number, decay: number): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const data = buffer.getChannelData(c);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return buffer;
  }

  setPitchOffset(multiplier: number): void {
    this._pitch.set(multiplier);
    const semitones = 12 * Math.log2(multiplier || 1);
    this.jungle?.setPitchOffset(semitones);
  }

  setReverb(on: boolean): void {
    this._reverbOn.set(on);
    if (!this.reverbSend || !this.ctx) return;
    this.reverbSend.gain.setTargetAtTime(on ? 0.4 : 0, this.ctx.currentTime, 0.05);
  }

  override reset(): void {
    try { this.ctx?.close(); } catch {}
    this.ctx = null;
    this.jungle = null;
    this.reverbNode = null;
    this.reverbSend = null;
    this.dryGain = null;
  }
}

export { JungleReverbProcessor as JungleAudioProcessor };
