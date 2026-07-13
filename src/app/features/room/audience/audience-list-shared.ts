import { getLanguageById, getLanguageFlag } from '@shared/data/languages';
import { AudienceUser } from '../models/room-model';

export type ViewMode = 'grid' | 'list';

export interface LanguageGroup {
  readonly language: string;
  readonly flag: string;
  readonly users: AudienceUser[];
}

const SINGLETON_MERGE_THRESHOLD = 3;

/** Groups non-ghost users by native language (largest group first, ties broken
 *  alphabetically), folds languages with exactly one speaker into an "Other languages"
 *  bucket once there are more than {@link SINGLETON_MERGE_THRESHOLD} of them (avoids a long
 *  tail of one-person language sections), and prepends a "Ghosts" group when any are
 *  present. */
export function groupUsersByLanguage(users: readonly AudienceUser[]): readonly LanguageGroup[] {
  const ghosts = users.filter((u) => u.isGhost);
  const map = new Map<string, LanguageGroup>();
  for (const u of users) {
    if (u.isGhost) continue;
    const langId = u.base?.nativeLang ?? -1;
    const langName = getLanguageById(langId)?.name ?? 'Unknown';
    const langFlag = getLanguageFlag(langId);
    if (!map.has(langName)) map.set(langName, { language: langName, flag: langFlag, users: [] });
    map.get(langName)!.users.push(u);
  }
  let groups = Array.from(map.values()).sort(
    (a, b) => b.users.length - a.users.length || a.language.localeCompare(b.language),
  );

  const singletons = groups.filter((g) => g.users.length === 1);
  if (singletons.length > SINGLETON_MERGE_THRESHOLD) {
    const rest = groups.filter((g) => g.users.length > 1);
    const other = singletons.flatMap((g) => g.users);
    groups = [...rest, { language: 'Other languages', flag: '🌐', users: other }];
  }

  return ghosts.length ? [{ language: 'Ghosts', flag: '👻', users: ghosts }, ...groups] : groups;
}
