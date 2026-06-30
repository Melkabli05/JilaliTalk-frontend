import { firstValueFrom } from 'rxjs';
import type { ConfirmService } from '@core/services/confirm.service';
import type { ToastService } from '@core/services/toast.service';
import type { RoomApi } from '@features/room/data/room-api';
import type { RoomRealtimeEvent } from '@core/realtime/room-realtime-events';

export async function handleRealtimeEvent(
  event: RoomRealtimeEvent | null,
  confirm: ConfirmService,
  api: RoomApi,
  toast: ToastService,
  cname: string | null,
  busiType: number,
  userId: number,
  isHost: boolean,
  getNickname: (userId: number) => string,
): Promise<void> {
  switch (event?.type) {
    case 'stage_invite': {
      if (Number(event.userId) !== userId) break;
      const accepted = await confirm.ask({
        title: 'Stage Invitation',
        message: 'The host has invited you to join the stage. Accept?',
        confirmLabel: 'Accept',
        cancelLabel: 'Decline',
      });
      if (!cname) break;
      await firstValueFrom(api.stageInviteApproval(cname, busiType, 3, accepted ? 1 : 2));
      toast.success(accepted ? 'You joined the stage' : 'Invite declined');
      break;
    }
    case 'mod_invite': {
      if (Number(event.userId) !== userId) break;
      const accepted = await confirm.ask({
        title: 'Moderator Invitation',
        message: 'You have been invited to become a moderator. Accept?',
        confirmLabel: 'Accept',
        cancelLabel: 'Decline',
      });
      if (accepted && cname) {
        await firstValueFrom(api.approveManager(cname, userId));
        toast.success('You are now a moderator');
      }
      break;
    }
    case 'stage_raisehand': {
      if (!isHost || event.raisehandType !== 1 || !cname) break;
      const raiserId = Number(event.userId);
      const nickname = getNickname(raiserId);
      const approved = await confirm.ask({
        title: 'Raise Hand',
        message: `${nickname} wants to join the stage. Approve?`,
        confirmLabel: 'Approve',
        cancelLabel: 'Dismiss',
      });
      if (approved) {
        await firstValueFrom(api.raiseHandApproval(cname, busiType, raiserId, 1));
        toast.success(`${nickname} approved`);
      }
      break;
    }
    case 'stage_kick':
      if (Number(event.userId) === userId) {
        toast.warning(`You were removed from the stage by ${event.managerName}`);
      }
      break;
    case 'stage_device_control':
      if (event.deviceType === 1 && Number(event.userId) === userId) {
        toast.warning('You were muted');
      }
      break;
    case 'mod_unmuted':
      if (Number(event.userId) === userId) {
        toast.success('You can speak now');
      }
      break;
    case 'mod_accepted':
      if (Number(event.userId) === userId) {
        toast.success('You are now a moderator');
      }
      break;
    case 'mod_removed':
      if (Number(event.userId) === userId) {
        toast.warning('You are no longer a moderator');
      }
      break;
    default:
      break;
  }
}
