import { UserRole } from '@core/models/user-role';

/** Shared by StageUserComponent (voice) and VideoStageUserComponent (video) — both stage
 *  tile variants show the same HOST/MOD text label, just with different badge styling. */
export function stageRoleLabel(role: UserRole | undefined): 'HOST' | 'MOD' | '' {
  switch (role) {
    case UserRole.Host:
      return 'HOST';
    case UserRole.Moderator:
      return 'MOD';
    default:
      return '';
  }
}

export function stageRingColor(role: UserRole | undefined): string {
  switch (role) {
    case UserRole.Host:
      return 'var(--color-gold-400)';
    case UserRole.Moderator:
      return 'var(--color-primary-300)';
    default:
      return 'var(--color-neutral-200)';
  }
}

export function stageAriaLabel(
  nickname: string | null,
  roleLabel: string,
  isAway: boolean | undefined,
  isTurnOnMic: boolean,
  isSpeaking: boolean,
): string {
  const parts = [nickname ?? 'User'];
  if (isAway) parts.push('away');
  else if (roleLabel) parts.push(roleLabel);
  if (!isTurnOnMic) parts.push('muted');
  if (isSpeaking) parts.push('speaking');
  return parts.join(', ');
}

export function videoStageAriaLabel(
  nickname: string | null,
  roleLabel: string,
  isTurnOnMic: boolean,
  isActiveSpeaker: boolean,
  hasVideoTrack: boolean,
): string {
  const parts = [nickname];
  if (roleLabel) parts.push(roleLabel);
  parts.push(!isTurnOnMic ? 'muted' : isActiveSpeaker ? 'speaking' : 'mic on');
  parts.push(hasVideoTrack ? 'camera on' : 'camera off');
  return parts.join(', ');
}
