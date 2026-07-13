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
      processor.on('pipeerror', (err: Error) => {
        console.warn('[AgoraRtc] denoiser pipe error, falling back to unprocessed audio:', err);
        processor.unpipe();
        track.unpipe();
        track.pipe(track.processorDestination);
      });
      processor.on('overload', () => {
        console.warn('[AgoraRtc] denoiser overloaded (falling behind real-time) — audio may glitch');
      });
      track.pipe(processor).pipe(track.processorDestination);
      this.processor = processor;
      await this.applyLevel(level);
    } catch (err) {
      console.warn('[AgoraRtc] AI denoiser unavailable, publishing without it:', err);
    }
  }

  /** level 0 disables the processor outright (bypass, matching "off" in the UI) rather than
   *  just leaving it enabled at the softest setting — a user who picked "off" gets unprocessed
   *  audio, not a denoiser they can't see running. 1-2 map to SOFT, 3 to AGGRESSIVE; there's no
   *  native graduated scale to mirror here (setLevel only has two steps), so the 4-step UI
   *  collapses onto it as evenly as it can. */
  async applyLevel(level: NoiseSuppressionLevel): Promise<void> {
    const processor = this.processor;
    if (!processor) return;
    try {
      if (level === 0) {
        if (processor.enabled) await processor.disable();
        return;
      }
      await processor.setLevel(level >= 3 ? 'AGGRESSIVE' : 'SOFT');
      if (!processor.enabled) await processor.enable();
    } catch (err) {
      console.warn('[AgoraRtc] failed to apply denoiser level:', err);
    }
  }

  async detach(): Promise<void> {
    if (!this.processor) return;
    const processor = this.processor;
    this.processor = null;
    try {
      processor.unpipe();
      await processor.destroy();
    } catch {
      // best-effort cleanup — the track itself is being torn down regardless
    }
  }
}
