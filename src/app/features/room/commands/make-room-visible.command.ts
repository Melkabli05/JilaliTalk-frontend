import { firstValueFrom } from 'rxjs';
import { RoomApi } from '../api/room-api';
import { RoomStore } from '../store/room-store';
import { RoomRosterStore } from '../roster/roster-store';
import { VoiceRoomInfo, LiveRoomInfo, StageUsersResponse, AudienceUsersResponse } from '../models/room-model';
import { BffRoomSocketService } from '@core/realtime/bff-room-socket.service';
import { ToastService } from '@core/services/toast.service';
import { ActiveCallStore } from '@store/active-call.store';

export interface MakeRoomVisibleDeps {
  roomStore: RoomStore;
  rosterStore: RoomRosterStore;
  api: RoomApi;
  bffWs: BffRoomSocketService;
  toast: ToastService;
  activeCallStore: ActiveCallStore;
  syncVisibilityToUrl: (isVisible: boolean) => void;
  destroying: () => boolean;
}

/**
 * Voice fetches the join bundle and calls joinRoom concurrently (Promise.allSettled) since
 * a stale bundle response doesn't need to block flipping visible; video does them
 * sequentially because its bundle-fetch failure path still needs joinRoom to have already
 * succeeded before it's safe to flip local state. Both intentional, not merged.
 */
export async function makeVoiceRoomVisible(
  cname: string,
  busiType: number,
  deps: MakeRoomVisibleDeps,
): Promise<void> {
  const { roomStore, rosterStore, api, bffWs, toast, activeCallStore, syncVisibilityToUrl, destroying } = deps;

  const [bundleResult, joinResult] = await Promise.allSettled([
    firstValueFrom(api.fetchJoinBundle<VoiceRoomInfo>(cname, busiType)),
    firstValueFrom(api.joinRoom(cname, busiType)),
  ]);

  if (joinResult.status === 'rejected') {
    toast.error('Failed to rejoin visibly');
    return;
  }
  // The user may have left the room (or the page been destroyed) while these
  // requests were in flight — don't reconnect WS/reset stores for a page no
  // longer showing.
  if (destroying()) return;

  const bundleOk = bundleResult.status === 'fulfilled' ? bundleResult.value : null;
  if (!bundleOk) {
    toast.error('Failed to rejoin — room info unavailable');
  }
  const voiceInfo = bundleOk?.voiceRoomInfo;
  const stage = bundleOk?.stageUsers;
  const audience = bundleOk?.audienceUsers;

  roomStore.setVisibility(true);
  syncVisibilityToUrl(true);
  bffWs.connect(
    cname,
    voiceInfo?.hostInfo?.userId ?? 0,
    busiType,
    voiceInfo?.configInfo?.heartbeatSecond ?? null,
  );
  rosterStore.setCname(cname);
  // Clears only the stage list (pre-merge, this was rosterStore.reset() alone) — not
  // the full rosterStore.reset(), which would also wipe the cname just set above.
  rosterStore.updateStageUsers([]);
  if (stage?.list) rosterStore.updateStageUsers([...stage.list]);
  if (audience?.list) rosterStore.updateAudienceUsers([...audience.list]);
  // Snapshot is meaningless for a "go visible" toggle (only relevant to a restore).
  // Update it to match the new visible state so a future minimize→restore cycle
  // doesn't capture stale invisible=true.
  activeCallStore.setInvisible(false);
  toast.success('You are now visible');
}

export async function makeVideoRoomVisible(
  cname: string,
  busiType: number,
  deps: MakeRoomVisibleDeps,
): Promise<void> {
  const { roomStore, rosterStore, api, bffWs, toast, activeCallStore, syncVisibilityToUrl, destroying } = deps;

  // joinRoom is the authoritative call — if it fails the user isn't
  // server-side joined, so we must NOT flip local state to visible
  // (would leave the user in an inconsistent "visible" state with
  // no upstream record). The bundle fetch is best-effort: if it
  // fails we still flip visible and connect WS, but the toast warns
  // and the stage/audience lists stay empty until the next reconcile.
  try {
    await firstValueFrom(api.joinRoom(cname, busiType));
  } catch {
    toast.error('Failed to rejoin visibly');
    return;
  }
  // The user may have left the room (or the page been destroyed) while this
  // request was in flight — don't reconnect WS/reset stores for a page no
  // longer showing.
  if (destroying()) return;

  let liveInfo: LiveRoomInfo | undefined;
  let stage: StageUsersResponse | undefined;
  let audience: AudienceUsersResponse | undefined;
  try {
    const bundle = await firstValueFrom(api.fetchJoinBundle<LiveRoomInfo>(cname, busiType));
    liveInfo = bundle.voiceRoomInfo;
    stage = bundle.stageUsers;
    audience = bundle.audienceUsers;
  } catch {
    toast.error('Failed to rejoin — room info unavailable');
  }
  if (destroying()) return;

  roomStore.setVisibility(true);
  syncVisibilityToUrl(true);
  bffWs.connect(cname, liveInfo?.hostInfo?.userId ?? 0, busiType);
  rosterStore.setCname(cname);
  // Clears only the stage list (pre-merge, this was rosterStore.reset() alone) — not
  // the full rosterStore.reset(), which would also wipe the cname just set above.
  rosterStore.updateStageUsers([]);
  if (stage?.list) rosterStore.updateStageUsers([...stage.list]);
  if (audience?.list) rosterStore.updateAudienceUsers([...audience.list]);
  activeCallStore.setInvisible(false);
  toast.success('You are now visible');
}
