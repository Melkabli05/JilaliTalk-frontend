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
 * The Agora client joined in 'live' mode for visible users and 'rtc' mode for
 * invisible users. enablePublishing() flips role/reconnects accordingly. Critically,
 * the BFF must be told we're an active room participant around the flip — otherwise
 * upstream never delivers a user_published event to other clients and nobody
 * hears the audio even though Agora technically published it. So this command
 * mirrors what makeInvisible/makeVisible already do: api.leaveRoom on demote,
 * api.joinRoom on promote. Errors here are best-effort swallowed because the
 * primary action (publishing) already succeeded.
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
    const cname = deps.roomStore.cname();
    const busiType = deps.roomStore.busiType();
    const isSpeaking = deps.rcs.agora.isPublishing();

    if (isSpeaking) {
      await deps.rcs.setMicEnabled(false);
      await deps.rcs.stopAudio();
      await deps.rcs.agora.enablePublishing(false);
      if (deps.destroying()) return;
      // Mirror makeInvisible: tell the BFF we've left the active roster. The mic
      // track is gone, but upstream still considers us a room member until
      // leaveRoom fires a user_quit event.
      if (cname) {
        await firstValueFrom(deps.api.leaveRoom(cname, busiType)).catch(() => {});
      }
      deps.roomStore.setMicOn(false);
      deps.rosterStore.updateUserMicStatus(deps.roomStore.userId(), false);
      return;
    }

    // Promote to publisher mid-session. For visible users this is a no-reconnect
    // setClientRole('host') flip; for invisible users it's a full 'rtc'→'live'
    // reconnect in 'live' mode as host.
    await deps.rcs.agora.enablePublishing(true);
    if (deps.destroying()) return;
    // Tell the BFF we're an active publisher. Best-effort: a failed joinRoom
    // doesn't roll back the publish — the user can still see their own mic
    // indicator; only the audience fan-out is missing.
    if (cname) {
      await firstValueFrom(deps.api.joinRoom(cname, busiType)).catch(() => {});
    }
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