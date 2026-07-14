import AgoraRTC, { type ILocalAudioTrack } from 'agora-rtc-sdk-ng';
import { AIDenoiserExtension, type IAIDenoiserProcessor } from 'agora-extension-ai-denoiser';

export type NoiseSuppressionLevel = 0 | 1 | 2 | 3;

/**
 * Owns the AI-denoiser extension/processor lifecycle for a single mic track, split out of
 * `AgoraRtcService` so that service's job stays "manage the RTC connection," not also "know
 * how to pipe a track through Agora's WASM denoiser and recover from a pipeline error."
 * Best-effort: an unsupported browser or a failed WASM load just means the track publishes
 * unprocessed, never a broken mic.
 */
export class AgoraDenoiserController {
  private extension: AIDenoiserExtension | null = null;
  private processor: IAIDenoiserProcessor | null = null;
  private attachedTrack: ILocalAudioTrack | null = null;

  /** Lazily registers the extension and reports whether this browser can actually run it —
   *  callable before the mic track exists, so AgoraRtcService can decide whether native ANS
   *  needs to stay on as a fallback (see getAudioTrackOptions) *before* creating the track,
   *  instead of only finding out once attach() runs after the track already exists. */
  isSupported(): boolean {
    if (!this.extension) {
      const extension = new AIDenoiserExtension({ assetsPath: '/external' });
      AgoraRTC.registerExtensions([extension]);
      this.extension = extension;
    }
    return this.extension.checkCompatibility();
  }

  async attach(track: ILocalAudioTrack, level: NoiseSuppressionLevel): Promise<void> {
    try {
      if (!this.isSupported() || !this.extension) return;

      const processor = this.extension.createProcessor();
      this.processor = processor;
      this.attachedTrack = track;
      processor.on('pipeerror', (err: Error) => {
        console.warn('[AgoraRtc] denoiser pipe error, falling back to unprocessed audio:', err);
        this.bypassProcessor();
      });
      processor.on('overload', () => {
        console.warn('[AgoraRtc] denoiser overloaded (falling behind real-time) — audio may glitch');
        // pipeerror keeps audio flowing; overload does not. Surface so the caller can flag
        // the UI rather than leaving the user with glitching audio and no signal.
        this.overloadCount++;
        this.notifyDegraded('overload');
      });
      track.pipe(processor).pipe(track.processorDestination);
      await this.applyLevel(level);
    } catch (err) {
      console.warn('[AgoraRtc] AI denoiser unavailable, publishing without it:', err);
    }
  }

  /** level 0 takes the denoiser out of the audio path entirely (unpipe + disable), so a user
   *  who picked "off" is guaranteed unprocessed audio — not a denoiser sitting disabled in the
   *  pipeline waiting to misbehave. 1-2 map to SOFT, 3 to AGGRESSIVE; there's no native
   *  graduated scale to mirror here (setLevel only has two steps), so the 4-step UI collapses
   *  onto it as evenly as it can. */
  async applyLevel(level: NoiseSuppressionLevel): Promise<void> {
    const processor = this.processor;
    if (!processor) return;
    try {
      if (level === 0) {
        if (processor.enabled) await processor.disable();
        // Already disabled? Make sure it's also un-piped so the bypass is structural,
        // not just functional — covers the case where applyLevel(0) runs before the
        // track was ever published through this processor.
        this.bypassProcessor();
        return;
      }
      // Re-attach the pipe if a previous level-0 / pipeerror tore it down.
      if (!this.isPipedThroughProcessor()) {
        const track = this.attachedTrack;
        if (track) track.pipe(processor).pipe(track.processorDestination);
      }
      await processor.setLevel(level >= 3 ? 'AGGRESSIVE' : 'SOFT');
      if (!processor.enabled) await processor.enable();
    } catch (err) {
      console.warn('[AgoraRtc] failed to apply denoiser level:', err);
    }
  }

  /** Take the processor out of the audio path. Called from level-0 and pipeerror paths.
   *  Re-piping the track straight to its own processorDestination routes around the broken
   *  (or deliberately-disabled) processor without leaving the track muted. */
  private bypassProcessor(): void {
    const processor = this.processor;
    const track = this.attachedTrack;
    if (!track) return;
    try { track.unpipe(); } catch {}
    if (processor) {
      try { processor.unpipe(); } catch {}
    }
    try { track.pipe(track.processorDestination); } catch {}
  }

  /** Best-effort check: does the track currently route through `processor`? Without an SDK
   *  getter for pipe state, this is approximated by whether the track's pipe destination
   *  is `processor.processorDestination` *and* the processor is still enabled. False when
   *  level-0 / pipeerror already bypassed. */
  private isPipedThroughProcessor(): boolean {
    const processor = this.processor;
    if (!processor || !processor.enabled) return false;
    const track = this.attachedTrack as any;
    // agora-rtc-sdk-ng doesn't expose pipe state directly; this is a heuristic. If the
    // SDK ever exposes a real pipe-state getter, swap this in.
    return track && typeof track.getPipeDest === 'function'
      ? track.getPipeDest() === processor
      : true;
  }

  /** Hook for callers that want to surface "mic degraded" UI (e.g. an "AI denoiser offline"
   *  badge). Set by AgoraRtcService; cleared when a healthy pipe-error count goes back to
   *  zero on the next successful level apply. */
  onDegraded: ((reason: 'overload' | 'pipe-error') => void) | null = null;

  private overloadCount = 0;

  private notifyDegraded(reason: 'overload' | 'pipe-error'): void {
    this.onDegraded?.(reason);
  }

  async detach(): Promise<void> {
    if (!this.processor && !this.attachedTrack) return;
    const processor = this.processor;
    const track = this.attachedTrack;
    this.processor = null;
    this.attachedTrack = null;
    try {
      processor?.unpipe();
      if (processor) await processor.destroy();
    } catch {
      // best-effort cleanup — the track itself is being torn down regardless
    }
    // Caller has already stopped/closed the track by the time detach() runs (see
    // stopAudio / disconnect in AgoraRtcService); we don't repipe here. If a future caller
    // wants to keep the track alive without denoising, they should call bypassProcessor()
    // before detaching.
    void track;
  }
}
