/**
 * Clears the OS-level "Call in progress" tile so iOS stops showing the room name in
 * Control Center / lock-screen. Best-effort — Safari < 14 throws on a null assignment.
 */
export function clearMediaSessionMetadata(): void {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = 'none';
  } catch {
    // Safari < 14 throws on null assignment — fail silent.
  }
}
