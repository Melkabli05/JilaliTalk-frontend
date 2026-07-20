/**
 * 1Hz-while-active typing broadcaster.
 *
 * Real HelloTalk pattern (per {@code prvgmsgpacket.js}: on each input event, refire
 * {@code typing=true} at most once per {@link REFIRE_INTERVAL_MS}, and fire {@code typing=false}
 * once after {@link STOP_DELAY_MS} of idleness, or immediately on explicit stop.
 *
 * The previous shape fired {@code typing=true} exactly once per "typing session" then
 * auto-stopped after a few seconds, so a user typing for 30 seconds appeared idle after 3.
 * Here we keep re-firing at 1Hz so the peer's typing indicator stays lit, and only stop on
 * idle or explicit {@link stop}.
 */
export interface TypingBroadcaster {
  notifyInput(peerId: number): void;
  stop(peerId: number): void;
  stopAll(): void;
}

/** One send per second while typing is the upstream cadence. */
export const REFIRE_INTERVAL_MS = 1000;

/** Stop after 3s of no keystrokes. Matches the previous stop-delay constant. */
export const STOP_DELAY_MS = 3000;

interface ActiveEntry {
  typingSent: boolean;
  lastSentAt: number;
  refireTimer: ReturnType<typeof setInterval> | null;
  stopTimer: ReturnType<typeof setTimeout> | null;
}

export function createTypingBroadcaster(
  send: (peerId: number, isTyping: boolean) => void,
  stopDelayMs: number = STOP_DELAY_MS,
  refireMs: number = REFIRE_INTERVAL_MS,
): TypingBroadcaster {
  const activePeers = new Map<number, ActiveEntry>();

  const clearStop = (peerId: number): void => {
    const entry = activePeers.get(peerId);
    if (entry?.stopTimer) {
      clearTimeout(entry.stopTimer);
      entry.stopTimer = null;
    }
  };

  const clearRefire = (peerId: number): void => {
    const entry = activePeers.get(peerId);
    if (entry?.refireTimer) {
      clearInterval(entry.refireTimer);
      entry.refireTimer = null;
    }
  };

  const fireStop = (peerId: number): void => {
    clearStop(peerId);
    clearRefire(peerId);
    const entry = activePeers.get(peerId);
    if (!entry) return;
    if (entry.typingSent) send(peerId, false);
    activePeers.delete(peerId);
  };

  const scheduleStop = (peerId: number): void => {
    const entry = activePeers.get(peerId);
    if (!entry) return;
    if (entry.stopTimer) clearTimeout(entry.stopTimer);
    entry.stopTimer = setTimeout(() => fireStop(peerId), stopDelayMs);
  };

  const startRefire = (peerId: number): void => {
    const entry = activePeers.get(peerId);
    if (!entry) return;
    if (entry.refireTimer) clearInterval(entry.refireTimer);
    entry.refireTimer = setInterval(() => {
      const cur = activePeers.get(peerId);
      if (!cur) return;
      // Refire only if there's been at least one input event since the last send (the
      // setInterval fires regardless of input). lastSentAt==0 means the initial send never
      // fired — guard against the peer being marked sent when no input has happened.
      if (cur.lastSentAt > 0) {
        send(peerId, true);
        cur.lastSentAt = Date.now();
      }
    }, refireMs);
  };

  return {
    notifyInput(peerId: number): void {
      const now = Date.now();
      const existing = activePeers.get(peerId);
      if (existing) {
        // Always reset the idle stop on any input.
        clearStop(peerId);
        existing.lastSentAt = now;
        // First send per session: only if we haven't already announced.
        if (!existing.typingSent) {
          send(peerId, true);
          existing.typingSent = true;
        }
        scheduleStop(peerId);
        return;
      }
      // Fresh session — start typing=true + the 1Hz refire + the idle stop.
      send(peerId, true);
      const entry: ActiveEntry = {
        typingSent: true,
        lastSentAt: now,
        refireTimer: null,
        stopTimer: null,
      };
      activePeers.set(peerId, entry);
      scheduleStop(peerId);
      startRefire(peerId);
    },
    stop(peerId: number): void {
      fireStop(peerId);
    },
    stopAll(): void {
      for (const [peerId, entry] of [...activePeers]) {
        if (entry.stopTimer) clearTimeout(entry.stopTimer);
        if (entry.refireTimer) clearInterval(entry.refireTimer);
        if (entry.typingSent) send(peerId, false);
        activePeers.delete(peerId);
      }
    },
  };
}
