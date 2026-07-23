import { DestroyRef, WritableSignal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RoomApi } from '../api/room-api';
import { RoomStore } from '../store/room-store';
import { RoomRosterStore } from '../roster/roster-store';
import { RoomConnectionService } from '@core/realtime/room-connection.service';
import { ToastService } from '@core/services/toast.service';

/**
 * Toggle speaking for a user who is in the audience (visible or invisible). Mirrors
 * the on-stage half of toggleMic — promotes the local client to publisher via
 * enablePublishing(true), creates a fresh mic track and publishes it, then later
 * demotes back to audience on stop.
 *
 * Two callers reuse this command:
 *  - the visible understage mic button (Feature 1): the user is in the audience list,
 *    can speak without joining the stage roster.
 *  - the invisible ghost-mic button (Feature 2): the user is invisible (no roster
 *    entry at all), but can still publish audio via Agora. The mic publish is the
 *    same wire-level event; only the visibility of "who's speaking" differs, and
 *    that is already handled by the absence of a roster entry.
 *
 * The Agora client joined in 'live' mode and started as either 'host' (visible) or
 * 'audience' (invisible). For invisible callers this is the only path to publishing
 * without reconnecting. For visible callers it skips the publisher-token round-trip
 * that the on-stage toggleMic uses — startAudio(null) is sufficient.
 */
export interface SpeakFromAudienceDeps {
  roomStore: RoomStore;
  rosterStore: RoomRosterStore;
  rcs: RoomConnectionService;
  api: RoomApi;
  toast: ToastService;
  destroyRef: DestroyRef;
  destroying: () => boolean;
  speakBusy: WritableSignal<boolean>;
}

export async function toggleSpeakFromAudience(deps: SpeakFromAudienceDeps): Promise<void> {
  if (deps.speakBusy()) return;
  deps.speakBusy.set(true);
  try {
    const isSpeaking = deps.rcs.agora.isPublishing();
    if (isSpeaking) {
      await deps.rcs.setMicEnabled(false);
      await deps.rcs.stopAudio();
      if (deps.destroying()) return;
      deps.roomStore.setMicOn(false);
      deps.rosterStore.updateUserMicStatus(deps.roomStore.userId(), false);
      return;
    }
    // Promote to publisher mid-session (idempotent if already host), then create and
    // publish a fresh track. startAudio(null) reuses the existing RTC connection.
    await deps.rcs.agora.enablePublishing(true);
    await deps.rcs.startAudio(null);
    if (deps.destroying()) return;
    deps.roomStore.setMicOn(true);
    deps.rosterStore.updateUserMicStatus(deps.roomStore.userId(), true);
  } catch {
    deps.toast.error('Failed to start microphone');
  } finally {
    deps.speakBusy.set(false);
  }
}