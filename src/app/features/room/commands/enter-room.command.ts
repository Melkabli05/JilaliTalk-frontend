import { DestroyRef, WritableSignal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RoomApi } from '../api/room-api';
import { RoomStore } from '../store/room-store';
import { JoinCancelledError } from '../store/base-room-store';
import { RoomRosterStore } from '../roster/roster-store';
import { CommentsStore } from '../comments/comments-store';
import { InRoomRtmStore } from '../in-room-rtm/in-room-rtm-store';
import { VoiceRoomInfo, LiveRoomInfo, StageUsersResponse, AudienceUsersResponse, CommentsResponse } from '../models/room-model';
import { RoomConnectionService } from '@core/realtime/room-connection.service';
import { HtRoomConnectionService } from '@core/realtime/ht-room-connection.service';
import { ToastService } from '@core/services/toast.service';
import { ActiveCallStore } from '@store/active-call.store';

/**
 * The "join the room" flow, split into two functions rather than one — voice and video
 * diverge in more places than they agree, and every divergence below is preserved exactly
 * as it was in the pre-extraction page components, including two that read like they might
 * be bugs but are NOT this refactor's to fix:
 *  - video's JoinCancelledError/fetch-fail catches navigate to a hardcoded ['/rooms'], not
 *    its own leaveNavTarget (['/rooms/live']) — voice's catch uses its leaveNavTarget
 *    variable, which happens to also resolve to ['/rooms'].
 *  - video re-derives `actualCname` from the join-bundle response and uses it for every
 *    downstream call (bffWs.connect, rosterStore.setCname, rcs.connect); voice never does
 *    this and uses the original routed `cname` throughout.
 * Other real, intentional differences kept apart: voice sets `roomLevelInfo` and OS
 * mediaSession metadata on RTC connect, video does neither; voice's active-call snapshot
 * update calls `syncCurrentRoom` + conditionally `restore()`, video calls `minimize()`
 * instead (see the inline comment in enterVideoRoom for why); voice's bffWs.connect passes
 * a heartbeatSecond 4th argument, video's does not.
 */
export interface EnterVoiceRoomDeps {
  roomStore: RoomStore;
  rosterStore: RoomRosterStore;
  commentsStore: CommentsStore;
  rtmStore: InRoomRtmStore;
  activeCallStore: ActiveCallStore;
  api: RoomApi;
  bffWs: HtRoomConnectionService;
  rcs: RoomConnectionService;
  router: Router;
  toast: ToastService;
  destroyRef: DestroyRef;
  agoraAppId: string;
  reqUserId: WritableSignal<number>;
  leaveNavTarget: string[];
  resolveRoomEntry: (cname: string) => Promise<boolean>;
  destroying: () => boolean;
}

export async function enterVoiceRoom(
  cname: string,
  busiType: number,
  fresh: boolean,
  visible: boolean,
  deps: EnterVoiceRoomDeps,
): Promise<void> {
  const { roomStore, rosterStore, commentsStore, rtmStore, activeCallStore, api, bffWs, rcs, router, toast, destroyRef, agoraAppId, reqUserId, leaveNavTarget, resolveRoomEntry, destroying } = deps;

  const isRestore = await resolveRoomEntry(cname);
  rosterStore.setRoomContext(cname, busiType);
  try {
    const visibleOnFreshJoin = isRestore
      ? !activeCallStore.isInvisible()
      : visible;
    await roomStore.enterRoom(cname, busiType, visibleOnFreshJoin);
  } catch (err) {
    if (err instanceof JoinCancelledError) {
      await router.navigate(leaveNavTarget);
      await roomStore.leaveRoom();
      rosterStore.reset();
      return;
    }
    throw err;
  }
  // The user may have navigated away while enterRoom's join-roster request was
  // in flight — the page's destroyRef.onDestroy has already run rcs.leave() by
  // now, so continuing here would open a fresh WS/RTC connection nothing will
  // ever tear down. Bail before any further side effects.
  if (destroying()) return;
  activeCallStore.syncCurrentRoom(
    cname,
    busiType,
    roomStore.name(),
    roomStore.isMicOn(),
    !roomStore.isVisible(),
  );

  if (isRestore) {
    activeCallStore.restore();
  }

  let voiceInfo: VoiceRoomInfo;
  let stage: StageUsersResponse | undefined;
  let audience: AudienceUsersResponse | undefined;
  let comments: CommentsResponse | undefined;
  try {
    if (fresh) {
      // Fresh room (just created via create-room-modal): upstream's stage/list + comment
      // endpoints reliably 500 on a cname created moments earlier — they require
      // voice_room_info to have completed for this room/session first. Only fetch
      // room info; let the realtime push events (user_join/stage_join/comment) populate
      // the lists once the websocket connects, which they will naturally as the first
      // audience member (us) and any other joiners/chat arrive. stage/audience/comments
      // intentionally stay undefined here — code below guards on that.
      voiceInfo = await firstValueFrom(
        api.fetchVoiceRoomInfo(cname).pipe(takeUntilDestroyed(destroyRef)),
      );
    } else {
      // Cancels the actual in-flight HTTP request (not just the continuation guarded
      // below) if the page is destroyed mid-fetch — the largest payload in the join
      // flow, so the one most worth not letting complete for nothing on the wire.
      const bundle = await firstValueFrom(
        api.fetchJoinBundle<VoiceRoomInfo>(cname, busiType).pipe(takeUntilDestroyed(destroyRef)),
      );
      voiceInfo = bundle.voiceRoomInfo;
      stage = bundle.stageUsers;
      audience = bundle.audienceUsers;
      comments = bundle.comments;
    }
  } catch {
    // Also reached when takeUntilDestroyed cancelled the request above (not just a
    // real fetch failure) — don't force-navigate a user who has already left this
    // page to somewhere else entirely.
    if (destroying()) return;
    await router.navigate(['/']);
    toast.error('Room not found. Please create a new one.');
    return;
  }
  // Same race as above: bail if the page was destroyed while this fetch was in flight.
  if (destroying()) return;

  const ch = voiceInfo.channelInfo;
  roomStore.setCname(cname);
  roomStore.setRoomName(ch?.name?.trim() ?? '');
  roomStore.setRoomTopic(ch?.topic ?? '');
  roomStore.setRoomLanguage(ch?.langId ?? 1);
  roomStore.setRtcInfo(ch?.rtcInfo ?? null);
  roomStore.setRoomLevelInfo(voiceInfo.roomLevelInfo ?? null);
  const reqUser = voiceInfo.reqUserInfo;
  if (reqUser?.userId) {
    reqUserId.set(reqUser.userId);
    roomStore.setUserId(reqUser.userId);
    commentsStore.setCurrentUserId(reqUser.userId);
  }
  if (reqUser?.role) roomStore.setRole(reqUser.role);
  if (reqUser?.base?.nickname) roomStore.setNickname(reqUser.base.nickname);
  if (reqUser?.base?.headUrl) roomStore.setHeadUrl(reqUser.base.headUrl);
  if (reqUser?.base?.nationality) roomStore.setNationality(reqUser.base.nationality);

  // Snapshot is read but no longer authoritative for _isVisible — enterRoom already
  // applied it before we got here. We only need the snapshot here to decide mic state
  // (mic is captured at minimize time, then re-applied on restore).
  if (isRestore) {
    roomStore.setMicOn(activeCallStore.isMicOn());
  }

  const isVisible = roomStore.isVisible();

  // On a minimize→restore, RTC + WebSocket + RTM stay connected from the min'd state;
  // opening them again would tear down and re-establish those sockets for nothing.
  if (!isRestore) {
    const heartbeatHostId = isVisible ? (voiceInfo.hostInfo?.userId ?? 0) : 0;
    bffWs.connect(cname, heartbeatHostId, busiType, voiceInfo.configInfo?.heartbeatSecond ?? null);
  }

  const uid = roomStore.userId();

  if (isVisible) rosterStore.setCname(cname);
  if (stage?.list) rosterStore.updateStageUsers([...stage.list]);
  if (audience?.list) rosterStore.updateAudienceUsers([...audience.list]);
  if (comments?.items) commentsStore.updateComments([...comments.items]);

  rtmStore.setCurrentUid(uid);

  if (!isRestore) {
    try {
      const rtcInfo = roomStore.rtcInfo();
      const rtcToken = rtcInfo?.token ?? null;
      const appId = rtcInfo?.appId?.trim() ? rtcInfo.appId : agoraAppId;
      await rcs.connect(cname, uid, rtcToken, appId, !isVisible);
      // Populate the OS-level "Call in progress" tile so iOS shows the
      // room name in Control Center / lock-screen instead of a generic
      // "JilaliTalk" line. Cleared in onLeave() (and destroyRef.onDestroy
      // covers the minimize→destroy path). Guarded by `'mediaSession' in
      // navigator` because Safari < 14 and some embedded webviews don't
      // expose it.
      if ('mediaSession' in navigator) {
        const hostName = voiceInfo.hostInfo?.base?.nickname?.trim() || 'Voice room';
        const roomTitle = (voiceInfo.channelInfo?.name?.trim()) || cname;
        try {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: roomTitle,
            artist: hostName,
            album: 'JilaliTalk',
          });
          navigator.mediaSession.playbackState = 'playing';
        } catch {
          // Older Safari throws on MediaMetadata construction — fail silent.
        }
      }
    } catch {
      toast.error('Failed to connect to audio');
    }

    try {
      await rcs.connectRtm(uid);
      await rcs.subscribeRtmChannel(cname);
    } catch {
    }
  }
}

export interface EnterVideoRoomDeps {
  roomStore: RoomStore;
  rosterStore: RoomRosterStore;
  commentsStore: CommentsStore;
  rtmStore: InRoomRtmStore;
  activeCallStore: ActiveCallStore;
  api: RoomApi;
  bffWs: HtRoomConnectionService;
  rcs: RoomConnectionService;
  router: Router;
  toast: ToastService;
  destroyRef: DestroyRef;
  agoraAppId: string;
  reqUserId: WritableSignal<number>;
  resolveRoomEntry: (cname: string) => Promise<boolean>;
  destroying: () => boolean;
}

export async function enterVideoRoom(
  cname: string,
  busiType: number,
  fresh: boolean,
  visible: boolean,
  deps: EnterVideoRoomDeps,
): Promise<void> {
  const { roomStore, rosterStore, commentsStore, rtmStore, activeCallStore, api, bffWs, rcs, router, toast, destroyRef, agoraAppId, reqUserId, resolveRoomEntry, destroying } = deps;

  const isRestore = await resolveRoomEntry(cname);
  rosterStore.setRoomContext(cname, busiType);
  try {
    await roomStore.enterRoom(cname, busiType, visible);
  } catch (err) {
    if (err instanceof JoinCancelledError) {
      await router.navigate(['/rooms']);
      await roomStore.leaveRoom();
      rosterStore.reset();
      return;
    }
    throw err;
  }
  // The user may have navigated away while enterRoom's join-roster request was
  // in flight — the page's destroyRef.onDestroy has already run rcs.leave() by
  // now, so continuing here would open a fresh WS/RTC connection nothing will
  // ever tear down. Bail before any further side effects.
  if (destroying()) return;
  // Snapshot served its purpose for restore detection — and now becomes the
  // "I am currently in this room" live state that other consumers (e.g. the
  // UserInfoModal's "you're already in this room" check) can read. We update
  // the snapshot with the current room's cname + the user's visibility + mic
  // state. (The previous `clear()` made cname null while the user was in
  // a full-screen room, which broke the modal's "already in this room"
  // detection entirely.)
  activeCallStore.minimize(
    cname,
    busiType,
    roomStore.name(),
    roomStore.isMicOn(),
    !roomStore.isVisible(),
  );

  // For a fresh (just-created) room we only call liveRoomInfo; upstream's stage/list
  // + comment endpoints reliably 500 on a cname created moments earlier, requiring
  // live_room_info to have completed first. Realtime push events (user_join/stage_join/
  // comment) populate the rosters once the websocket connects. stage/audience/comments
  // intentionally stay undefined on the fresh path — code below guards on that.
  let liveInfo: LiveRoomInfo;
  let stage: StageUsersResponse | undefined;
  let audience: AudienceUsersResponse | undefined;
  let comments: CommentsResponse | undefined;
  try {
    if (fresh) {
      liveInfo = await firstValueFrom(
        api.fetchLiveRoomInfo(cname).pipe(takeUntilDestroyed(destroyRef)),
      );
    } else {
      // Cancels the actual in-flight HTTP request (not just the continuation guarded
      // below) if the page is destroyed mid-fetch — the largest payload in the join
      // flow, so the one most worth not letting complete for nothing on the wire.
      const bundle = await firstValueFrom(
        api.fetchJoinBundle<LiveRoomInfo>(cname, busiType).pipe(takeUntilDestroyed(destroyRef)),
      );
      liveInfo = bundle.voiceRoomInfo;
      stage = bundle.stageUsers;
      audience = bundle.audienceUsers;
      comments = bundle.comments;
    }
  } catch {
    // Also reached when takeUntilDestroyed cancelled the request above (not just a
    // real fetch failure) — don't force-navigate a user who has already left this
    // page to somewhere else entirely.
    if (destroying()) return;
    await router.navigate(['/rooms']);
    toast.error('Room not found');
    return;
  }
  // Same race as above: bail if the page was destroyed while this fetch was in flight.
  if (destroying()) return;

  const ch = liveInfo.channelInfo;
  const actualCname = ch?.cname || cname;
  roomStore.setCname(actualCname);
  roomStore.setRoomName(ch?.name?.trim() ?? '');
  roomStore.setRoomTopic(ch?.topic ?? '');
  roomStore.setRoomLanguage(ch?.langId ?? 1);
  roomStore.setRtcInfo(ch?.rtcInfo ?? null);
  const reqUser = liveInfo.reqUserInfo;
  if (reqUser?.userId) {
    reqUserId.set(reqUser.userId);
    roomStore.setUserId(reqUser.userId);
    commentsStore.setCurrentUserId(reqUser.userId);
  }
  if (reqUser?.role) roomStore.setRole(reqUser.role);
  if (reqUser?.base?.nickname) roomStore.setNickname(reqUser.base.nickname);
  if (reqUser?.base?.headUrl) roomStore.setHeadUrl(reqUser.base.headUrl);
  if (reqUser?.base?.nationality) roomStore.setNationality(reqUser.base.nationality);

  if (isRestore) {
    roomStore.setMicOn(activeCallStore.isMicOn());
  }

  const isVisible = roomStore.isVisible();
  // On a minimize→restore, RTC + WebSocket stay connected from the min'd state.
  if (!isRestore) {
    const heartbeatHostId = isVisible ? (liveInfo.hostInfo?.userId ?? 0) : 0;
    bffWs.connect(actualCname, heartbeatHostId, busiType);
  }
  const uid = roomStore.userId();

  if (isVisible) rosterStore.setCname(actualCname);
  if (stage?.list) rosterStore.updateStageUsers([...stage.list]);
  if (audience?.list) rosterStore.updateAudienceUsers([...audience.list]);
  if (comments?.items) commentsStore.updateComments([...comments.items]);

  rtmStore.setCurrentUid(uid);

  if (!isRestore) {
    try {
      const rtcInfo = roomStore.rtcInfo();
      const rtcToken = rtcInfo?.token ?? null;
      const appId = rtcInfo?.appId?.trim() ? rtcInfo.appId : agoraAppId;
      await rcs.connect(actualCname, uid, rtcToken, appId, !isVisible);
    } catch {
      toast.error('Failed to connect to audio');
    }

    try {
      await rcs.connectRtm(uid);
      await rcs.subscribeRtmChannel(actualCname);
    } catch {
    }
  }
}
