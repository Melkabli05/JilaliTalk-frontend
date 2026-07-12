interface PlayableTrack {
  play(): void;
}

/**
 * Recovers from the browser autoplay policy blocking a just-subscribed remote audio track:
 * arms a one-shot listener on the next click/touch/keydown to retry `.play()` on every
 * currently-known remote track. Split out of `AgoraRtcService` so the remote-user event
 * wiring doesn't also have to carry this browser-policy workaround inline.
 */
export class AutoplayAudioRecovery {
  private armed = false;
  private handler: (() => void) | null = null;

  constructor(private readonly getTracks: () => Iterable<PlayableTrack>) {}

  arm(): void {
    if (this.armed) return;
    this.armed = true;
    const resume = (): void => {
      for (const track of this.getTracks()) {
        try {
          track.play();
        } catch {
          return;
        }
      }
      this.disarm();
    };
    this.handler = resume;
    document.addEventListener('click', resume);
    document.addEventListener('touchstart', resume);
    document.addEventListener('keydown', resume);
  }

  disarm(): void {
    if (this.handler) {
      document.removeEventListener('click', this.handler);
      document.removeEventListener('touchstart', this.handler);
      document.removeEventListener('keydown', this.handler);
    }
    this.handler = null;
    this.armed = false;
  }
}
