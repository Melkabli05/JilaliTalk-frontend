import type { Observable } from 'rxjs';
import type { ModAction } from '../moderation/mod-store';
import type { RoomApi } from './room-api';

export function buildModActionDefs(
  api: RoomApi,
  cname: string,
  busiType: number,
  uid: number,
): Record<ModAction, { call: () => Observable<unknown>; toast: 'success' | 'info'; message: string }> {
  return {
    kick:              { call: () => api.kickFromStage(cname, busiType, uid),              toast: 'success', message: 'User kicked from stage' },
    mute:              { call: () => api.muteUser(cname, busiType, uid, true),              toast: 'success', message: 'User muted' },
    raise_hand:        { call: () => api.raiseHand(cname, busiType, 2),                    toast: 'info',    message: 'Hand lowered' },
    add_manager:       { call: () => api.setManager(cname, busiType, uid, 1),             toast: 'success', message: 'User promoted to moderator' },
    remove_manager:    { call: () => api.setManager(cname, busiType, uid, 2),             toast: 'success', message: 'Manager removed' },
    invite_to_stage:   { call: () => api.inviteToStage(cname, busiType, uid),             toast: 'info',    message: 'Invitation sent to stage' },
    ban:               { call: () => api.kickFromStage(cname, busiType, uid),             toast: 'success', message: 'User removed from stage' },
    approve_raise_hand:{ call: () => api.raiseHandApproval(cname, busiType, uid, 1),      toast: 'success', message: 'Hand approved' },
    reject_raise_hand: { call: () => api.raiseHandApproval(cname, busiType, uid, 2),      toast: 'info',    message: 'Hand rejected' },
  };
}
