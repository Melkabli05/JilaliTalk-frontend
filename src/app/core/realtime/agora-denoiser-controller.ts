import AgoraRTC, { type ILocalAudioTrack } from 'agora-rtc-sdk-ng';
import { AIDenoiserExtension, type IAIDenoiserProcessor } from 'agora-extension-ai-denoiser';

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

  async attach(track: ILocalAudioTrack): Promise<void> {
    try {
      if (!this.extension) {
        const extension = new AIDenoiserExtension({ assetsPath: '/external' });
        AgoraRTC.registerExtensions([extension]);
        this.extension = extension;
      }
      if (!this.extension.checkCompatibility()) return;

      const processor = this.extension.createProcessor();
      processor.on('pipeerror', (err: Error) => {
        console.warn('[AgoraRtc] denoiser pipe error, falling back to unprocessed audio:', err);
        processor.unpipe();
        track.unpipe();
        track.pipe(track.processorDestination);
      });
      track.pipe(processor).pipe(track.processorDestination);
      await processor.enable();
      this.processor = processor;
    } catch (err) {
      console.warn('[AgoraRtc] AI denoiser unavailable, publishing without it:', err);
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
