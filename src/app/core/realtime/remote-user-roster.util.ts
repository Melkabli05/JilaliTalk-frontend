export interface RemoteUser {
  readonly uid: number;
  readonly hasAudio: boolean;
  readonly hasVideo: boolean;
  readonly audioTrack: any | null;
  readonly videoTrack: any | null;
  readonly nickname: string;
  readonly isScreenShare: boolean;
}

interface AgoraRemoteUserLike {
  readonly uid: number;
  readonly nickname?: string;
  readonly audioTrack?: unknown;
  readonly videoTrack?: unknown;
}

/**
 * Pure roster-list transforms for `AgoraRtcService`'s `user-published`/`user-unpublished`/
 * `user-joined`/`user-left` handlers — separated out so "how the remote-user list changes
 * shape" is testable and readable independent of the RTC event wiring that triggers it.
 */

export function upsertRemoteUser(
  list: readonly RemoteUser[],
  user: AgoraRemoteUserLike,
  mediaType: 'audio' | 'video' | 'none',
): readonly RemoteUser[] {
  const uid = user.uid;
  const isScreenShare = String(uid).startsWith('2000');
  const existing = list.find((u) => u.uid === uid);
  if (existing) {
    return list.map((u) =>
      u.uid === uid
        ? {
            ...u,
            hasAudio: mediaType === 'audio' ? true : u.hasAudio,
            hasVideo: mediaType === 'video' ? true : u.hasVideo,
            audioTrack: mediaType === 'audio' ? (user.audioTrack ?? null) : u.audioTrack,
            videoTrack: mediaType === 'video' ? (user.videoTrack ?? null) : u.videoTrack,
            isScreenShare: isScreenShare ? true : u.isScreenShare,
          }
        : u,
    );
  }
  return [
    ...list,
    {
      uid,
      hasAudio: mediaType === 'audio',
      hasVideo: mediaType === 'video',
      audioTrack: mediaType === 'audio' ? (user.audioTrack ?? null) : null,
      videoTrack: mediaType === 'video' ? (user.videoTrack ?? null) : null,
      nickname: user.nickname ?? String(uid),
      isScreenShare,
    },
  ];
}

export function clearRemoteUserMedia(
  list: readonly RemoteUser[],
  uid: number,
  mediaType: 'audio' | 'video',
): readonly RemoteUser[] {
  return list.map((u) =>
    u.uid === uid
      ? {
          ...u,
          hasAudio: mediaType === 'audio' ? false : u.hasAudio,
          hasVideo: mediaType === 'video' ? false : u.hasVideo,
          audioTrack: mediaType === 'audio' ? null : u.audioTrack,
          videoTrack: mediaType === 'video' ? null : u.videoTrack,
        }
      : u,
  );
}

export function removeRemoteUser(list: readonly RemoteUser[], uid: number): readonly RemoteUser[] {
  return list.filter((u) => u.uid !== uid);
}
