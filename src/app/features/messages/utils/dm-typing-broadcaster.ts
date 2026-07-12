/**
 * Throttles outbound typing-indicator sends: "started typing" goes out once per burst
 * instead of on every keystroke, and "stopped typing" fires automatically after a pause —
 * split out of `MessagesPageComponent` so the composer's input handler doesn't also have to
 * own a timer/flag state machine inline. `stop()` is the single exit point (inactivity
 * timeout, blur, send, component destroy all call it), so the peer's "typing…" indicator can
 * never get stuck on if the sender navigates away or stops typing without blurring.
 */
export class DmTypingBroadcaster {
  private active = false;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly sendTyping: (peerId: number, isTyping: boolean) => void,
    private readonly stopDelayMs: number,
  ) {}

  notifyInput(peerId: number): void {
    if (!this.active) {
      this.active = true;
      this.sendTyping(peerId, true);
    }
    if (this.stopTimer) clearTimeout(this.stopTimer);
    this.stopTimer = setTimeout(() => this.stop(peerId), this.stopDelayMs);
  }

  stop(peerId: number): void {
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    if (!this.active) return;
    this.active = false;
    this.sendTyping(peerId, false);
  }
}
