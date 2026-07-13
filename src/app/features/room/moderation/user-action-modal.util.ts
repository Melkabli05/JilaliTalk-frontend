import { UserRole } from '@core/models/user-role';
import type { UserInfo, UserProfileDetails } from '@core/services/user-info.service';
import type { UserActionModalData } from './user-action-modal';

export function resolveDisplayName(info: UserInfo | null, data: UserActionModalData): string {
  return info?.nickname ?? data.nickname ?? data.base?.nickname ?? 'User';
}

export function resolveAvatarUrl(
  profileBase: UserProfileDetails['base'] | null | undefined,
  data: UserActionModalData,
): string {
  return profileBase?.headUrl || data.headUrl || data.base?.headUrl || '';
}

export function formatLocation(details: UserProfileDetails | null): string | null {
  const loc = details?.location;
  const parts = [loc?.city, loc?.fullCountry].filter((p): p is string => !!p);
  return parts.length ? parts.join(', ') : null;
}

export type OnlineStatus = 'Online' | 'Offline' | null;

export function resolveOnlineStatus(details: UserProfileDetails | null): OnlineStatus {
  const s = details?.onlineState?.onlineState;
  if (s == null) return null;
  return s === 1 ? 'Online' : 'Offline';
}

export function onlineStatusChipClass(status: OnlineStatus): string {
  return status === 'Online' ? 'chip-online' : 'chip-offline';
}

export function resolveLiveStatus(details: UserProfileDetails | null): boolean {
  const s = details?.liveState?.statusType;
  return s != null && s > 0;
}

export interface RelationStats {
  readonly followers: number;
  readonly following: number;
  readonly moments: number;
}

export function resolveRelationStats(details: UserProfileDetails | null): RelationStats | null {
  const relation = details?.relation;
  if (!relation) return null;
  return {
    followers: relation.followers ?? 0,
    following: relation.following ?? 0,
    moments: relation.moments ?? 0,
  };
}

/** Only these four tag categories surface in the moderation card — a deliberately narrower
 *  set than the full 8-category UserTagsInfo (occupation/education/hometown/travelling are
 *  left out here), so this stays a manual pick rather than switching to the BFF's already-
 *  flattened UserInfo.tags, which includes all eight. */
export function collectTagChips(details: UserProfileDetails | null): readonly string[] {
  const tags = details?.tags;
  if (!tags) return [];
  return [...(tags.hobby ?? []), ...(tags.mbti ?? []), ...(tags.zodiacSign ?? []), ...(tags.bloodType ?? [])]
    .map((t) => t.tag ?? '')
    .filter((tag) => tag.length > 0);
}

export function formatPointsSummary(details: UserProfileDetails | null): string | null {
  const p = details?.points;
  if (!p) return null;
  const total =
    (p.correct ?? 0) +
    (p.translate ?? 0) +
    (p.word ?? 0) +
    (p.speechToText ?? 0) +
    (p.textTranslate ?? 0) +
    (p.transliterate ?? 0);
  return total > 0 ? total.toLocaleString() : null;
}

export function formatRoleLabel(role: number | undefined, isGhost: boolean | undefined): string {
  if (isGhost) return 'Ghost (Invisible)';
  switch (role) {
    case UserRole.Host:
      return 'Host';
    case UserRole.Moderator:
      return 'Moderator';
    default:
      return 'Listener';
  }
}

export function formatRoleChipClass(role: number | undefined, isGhost: boolean | undefined): string {
  if (isGhost) return 'chip-ghost';
  switch (role) {
    case UserRole.Host:
      return 'chip-host';
    case UserRole.Moderator:
      return 'chip-mod';
    default:
      return 'chip-neutral';
  }
}

export function roleCrownType(role: number | undefined): 1 | 2 | null {
  switch (role) {
    case UserRole.Host:
      return 1;
    case UserRole.Moderator:
      return 2;
    default:
      return null;
  }
}

export function roleRingColor(role: number | undefined): string {
  switch (role) {
    case UserRole.Host:
      return 'var(--color-gold-400)';
    case UserRole.Moderator:
      return 'var(--color-primary-300)';
    default:
      return 'var(--color-border)';
  }
}

export function resolveIsTargetSelf(
  targetUserId: number | undefined,
  currentUserId: number | undefined,
): boolean {
  return targetUserId != null && targetUserId === currentUserId;
}
