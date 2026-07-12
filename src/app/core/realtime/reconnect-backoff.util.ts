export const MAX_RECONNECT_ATTEMPTS = 5;

const BACKOFF_BASE_MS = 1000;
const BACKOFF_CAP_MS = 30_000;

/** Upper bound of the jitter window for a given attempt count, before randomization. */
function backoffBound(attempt: number): number {
  let shifted = BACKOFF_BASE_MS;
  for (let i = 0; i < attempt && shifted < BACKOFF_CAP_MS; i++) {
    shifted = Math.min(BACKOFF_CAP_MS, shifted * 2);
  }
  return Math.min(BACKOFF_CAP_MS, shifted);
}

/**
 * Capped exponential backoff with full jitter: `delay = random(0, min(cap, base * 2^attempt))`.
 * Mirrors jilalibff's `ExponentialBackoff.java` — full jitter is the standard defense against
 * reconnect storms against a recovering upstream/BFF after a shared outage.
 */
export function backoffDelay(attempt: number): number {
  return Math.floor(Math.random() * (backoffBound(attempt) + 1));
}

/** Shared by every realtime connection service — IM and Room each expose their own signal
 *  typed to this union rather than redeclaring an identical one. */
export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
