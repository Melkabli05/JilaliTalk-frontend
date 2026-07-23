import { DestroyRef, WritableSignal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RoomApi } from '../api/room-api';
import { RoomStore } from '../store/room-store';
import { RoomRosterStore } from '../roster/roster-store';
import { RoomConnectionService } from '@core/realtime/room-connection.service';
import { ToastService } from '@core/services/toast.service';
import { logRealtime } from '@core/realtime/dev-log.util';

/**
 * Toggle speaking for a user who is in the audience (visible or invisible).
 *
 * Two callers reuse this command:
 *  - the visible understage mic button: the user is in the audience list,
 *    can speak without joining the stage roster.
 *  - the invisible ghost-mic button: the user is invisible (no roster entry
 *    at all), but can still publish audio via Agora.
 *
 * The Agora client joined in 'live' mode for visible users and 'rtc' mode for
 * invisible users. enablePublishing() flips role/reconnects accordingly. Critically,
 * the BFF must be told we're an active publisher around the flip — otherwise
 * upstream never delivers a user_published event to other clients and nobody
 * hears the audio even though Agora technically published it.
 *
 * Visible users go through the standard `joinRoom` / `leaveRoom` pair (the same
 * path `makeVisible` / `makeInvisible` already use). Invisible users go through
 * a dedicated `startGhostPublish` / `stopGhostPublish` pair that the BFF mediator
 * handles by tagging the stage_join WS push with `isGhost: true` so receivers
 * subscribe for audio but keep the speaker out of their audience/stage roster.
 * Both paths are best-effort: a failed BFF call doesn't roll back the publish.
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
    const isInvisible = !deps.roomStore.isVisible();
    logRealtime('toggleSpeakFromAudience() called', { isSpeaking, cname, busiType, isInvisible });

    if (isSpeaking) {
      await deps.rcs.setMicEnabled(false);
      await deps.rcs.stopAudio();
      await deps.rcs.agora.enablePublishing(false);
      if (deps.destroying()) return;
      if (cname) {
        if (isInvisible) {
          logRealtime('toggleSpeakFromAudience() demote → api.stopGhostPublish', { cname });
          await firstValueFrom(deps.api.stopGhostPublish(cname, busiType)).catch((err) =>
            logRealtime('toggleSpeakFromAudience() api.stopGhostPublish FAILED', { err: String(err) }),
          );
        } else {
          logRealtime('toggleSpeakFromAudience() demote → api.leaveRoom', { cname });
          await firstValueFrom(deps.api.leaveRoom(cname, busiType)).catch((err) =>
            logRealtime('toggleSpeakFromAudience() api.leaveRoom FAILED', { err: String(err) }),
          );
        }
      }
      deps.roomStore.setMicOn(false);
      deps.rosterStore.updateUserMicStatus(deps.roomStore.userId(), false);
      logRealtime('toggleSpeakFromAudience() demote done');
      return;
    }

    // Promote to publisher mid-session. For visible users this is a no-reconnect
    // setClientRole('host') flip; for invisible users it's a full 'rtc'→'live'
    // reconnect in 'live' mode as host.
    await deps.rcs.agora.enablePublishing(true);
    if (deps.destroying()) return;
    if (cname) {
      if (isInvisible) {
        logRealtime('toggleSpeakFromAudience() promote → api.startGhostPublish', { cname });
        await firstValueFrom(deps.api.startGhostPublish(cname, busiType)).catch((err) =>
          logRealtime('toggleSpeakFromAudience() api.startGhostPublish FAILED', { err: String(err) }),
        );
      } else {
        logRealtime('toggleSpeakFromAudience() promote → api.joinRoom', { cname });
        await firstValueFrom(deps.api.joinRoom(cname, busiType)).catch((err) =>
          logRealtime('toggleSpeakFromAudience() api.joinRoom FAILED', { err: String(err) }),
        );
      }
    }
    await deps.rcs.startAudio(null);
    if (deps.destroying()) return;
    deps.roomStore.setMicOn(true);
    deps.rosterStore.updateUserMicStatus(deps.roomStore.userId(), true);
    logRealtime('toggleSpeakFromAudience() promote done');
  } catch (err) {
    logRealtime('toggleSpeakFromAudience() FAILED', { err: String(err) });
    deps.toast.error('Failed to start microphone');
  } finally {
    deps.speakBusy.set(false);
  }
}
