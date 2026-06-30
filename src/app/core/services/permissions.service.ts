import { Injectable } from '@angular/core';
import { UserRole } from '@core/models/user-role';

/**
 * Target user's role in the room — used for permission checks.
 * Exported as a type alias so callers can use it without importing the implementation.
 */
export type TargetRole = UserRole;

export interface Permission {
  readonly canMute: boolean;
  readonly canKick: boolean;
  readonly canBan: boolean;
  readonly canLowerHand: boolean;
  readonly canInviteToStage: boolean;
  readonly canPromoteToMod: boolean;
  readonly canRemoveMod: boolean;
  readonly canApproveRaiseHand: boolean;
  readonly canRejectRaiseHand: boolean;
}

/**
 * Centralized permission service for the JilaliTalk room system.
 *
 * Implements the role model from livehub_business_rules.md:
 *   Role 1 (Host)   — full control, can act on role-2 and role-3
 *   Role 2 (Mod)    — can act on role-3 only
 *   Role 3 (Normal) — no moderation authority
 *
 * Inject into any component that needs to gate UI or logic on permissions.
 *
 * Usage:
 *   const permissions = inject(PermissionsService).forTarget(targetRole, myRole);
 *   if (permissions.canKick) { ... }
 *
 * Or use the reactive form in templates/components:
 *   const p = permissions.forTarget(targetRole(), myRole());
 *   <button [disabled]="!p.canMute">Mute</button>
 */
@Injectable()
export class PermissionsService {
  /**
   * Returns a Permission object for the given target role and current user role.
   *
   * @param targetRole — role of the user being acted upon
   * @param myRole — role of the current user in the room
   * @param isSelf — true if target is the current user (affects lower-hand logic)
   */
  forTarget(
    targetRole: TargetRole,
    myRole: UserRole,
    isSelf = false,
  ): Permission {
    const isHost = myRole === UserRole.Host;
    const isMod = myRole === UserRole.Moderator;
    const isNormal = targetRole === UserRole.Normal;
    const canAct = isHost || (isMod && isNormal); // host can act on mod+normal; mod can only act on normal

    return {
      canMute: canAct && isNormal,
      canKick: canAct,
      canBan: canAct,
      // Lower own hand (raisehandType: 2) — anyone can cancel their own.
      // Reject another's raised hand (raiseHandApproval type 2) — host/mod only.
      canLowerHand: isSelf ? true : canAct,
      canInviteToStage: isHost || isMod,
      canPromoteToMod: isHost,
      canRemoveMod: isHost,
      canApproveRaiseHand: canAct,
      canRejectRaiseHand: canAct,
    };
  }
}
