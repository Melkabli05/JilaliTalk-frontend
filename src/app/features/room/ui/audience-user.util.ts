import { UserRole } from '@core/models/user-role';
import type { AudienceUser } from '../models/room-model';

/** Audience tiles ring-color the avatar by the user's native language, not by role (that's
 *  stage-role.util.ts's job for stage tiles) — a quick visual cue for "who speaks what"
 *  while scanning the audience grid. */
export function audienceLanguageRingColor(hostLangName: string | undefined): string {
  const lang = hostLangName ?? '';
  if (lang.includes('English')) return 'var(--color-neutral-300)';
  if (lang.includes('Japanese')) return 'var(--color-warm-300)';
  if (lang.includes('Korean')) return 'var(--color-primary-300)';
  if (lang.includes('Chinese')) return 'var(--color-warm-400)';
  if (lang.includes('Spanish')) return 'var(--color-warm-400)';
  return 'var(--color-border)';
}

export function audienceModeLabel(role: UserRole | undefined, isGhost: boolean): string {
  if (isGhost) return '';
  return role === UserRole.Moderator ? 'MOD' : '';
}

export function audienceModeBadgeClass(role: UserRole | undefined, isGhost: boolean): string {
  if (isGhost) return 'ghost';
  return role === UserRole.Moderator ? 'moderator' : 'normal';
}

export function audienceAriaLabel(
  user: AudienceUser,
  displayName: string,
  modeLabel: string,
  isGhost: boolean,
): string {
  const parts = [displayName, modeLabel];
  if (isGhost) parts.push('connecting');
  if (user.isRaiseHand) parts.push('hand raised');
  return parts.filter(Boolean).join(', ');
}
