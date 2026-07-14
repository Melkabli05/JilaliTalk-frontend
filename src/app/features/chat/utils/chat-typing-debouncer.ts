export interface TypingBroadcaster {
  notifyInput(peerId: number): void;
  stop(peerId: number): void;
  stopAll(): void;
}

interface ActiveEntry {
  typingSent: boolean;
  stopTimer: ReturnType<typeof setTimeout> | null;
}

export function createTypingBroadcaster(
  send: (peerId: number, isTyping: boolean) => void,
  stopDelayMs: number,
): TypingBroadcaster {
  const activePeers = new Map<number, ActiveEntry>();

  const clearStop = (peerId: number): void => {
    const entry = activePeers.get(peerId);
    if (entry?.stopTimer) {
      clearTimeout(entry.stopTimer);
      entry.stopTimer = null;
    }
  };

  const scheduleStop = (peerId: number): void => {
    const entry = activePeers.get(peerId);
    if (!entry) return;
    if (entry.stopTimer) clearTimeout(entry.stopTimer);
    entry.stopTimer = setTimeout(() => {
      send(peerId, false);
      activePeers.delete(peerId);
    }, stopDelayMs);
  };

  return {
    notifyInput(peerId: number): void {
      const existing = activePeers.get(peerId);
      if (existing) {
        clearStop(peerId);
        if (existing.typingSent) scheduleStop(peerId);
        return;
      }
      send(peerId, true);
      activePeers.set(peerId, { typingSent: true, stopTimer: null });
      scheduleStop(peerId);
    },
    stop(peerId: number): void {
      const entry = activePeers.get(peerId);
      if (!entry) return;
      clearStop(peerId);
      send(peerId, false);
      activePeers.delete(peerId);
    },
    stopAll(): void {
      for (const [peerId, entry] of activePeers) {
        if (entry.stopTimer) clearTimeout(entry.stopTimer);
        send(peerId, false);
      }
      activePeers.clear();
    },
  };
}