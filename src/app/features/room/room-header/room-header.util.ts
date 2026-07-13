export type WsStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
export type HandIcon = 'leave-stage' | 'lower-hand' | 'join-stage' | 'raise';

export function wsStatusTooltip(status: WsStatus): string {
  switch (status) {
    case 'connected':
      return 'Live — realtime connected';
    case 'reconnecting':
      return 'Reconnecting…';
    case 'connecting':
      return 'Connecting…';
    case 'disconnected':
      return 'Disconnected — tap to refresh';
  }
}

export function handTooltip(isOnStage: boolean, isHandRaised: boolean, isModerator: boolean): string {
  if (isOnStage) return 'Leave stage';
  if (isHandRaised) return 'Lower hand';
  if (isModerator) return 'Join stage';
  return 'Raise hand';
}

export function handIcon(isOnStage: boolean, isHandRaised: boolean, isModerator: boolean): HandIcon {
  if (isOnStage) return 'leave-stage';
  if (isHandRaised) return 'lower-hand';
  if (isModerator) return 'join-stage';
  return 'raise';
}
