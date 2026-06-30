import { UserRole } from '@core/models/user-role';
import { StageUser } from '../data/room-model';

function stageRoleRank(role: UserRole): number {
  switch (role) {
    case UserRole.Host: return 0;
    case UserRole.Moderator: return 1;
    default: return 2;
  }
}

export function sortByStageRole<T extends Pick<StageUser, 'role'>>(users: readonly T[]): T[] {
  return [...users].sort((a, b) => stageRoleRank(a.role) - stageRoleRank(b.role));
}
