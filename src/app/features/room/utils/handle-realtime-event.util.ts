import { firstValueFrom } from 'rxjs';
import type { ToastService } from '@core/services/toast.service';
import type { RoomApi } from '@features/room/api/room-api';
import type { RoomRealtimeEvent } from '@core/realtime/room-realtime-events';

export async function handleRealtimeEvent(
  event: RoomRealtimeEvent | null,
  api: RoomApi,
  toast: ToastService,
  cname: string | null,
  busiType: number,
  userId: number,
  isHost: boolean,
  getNickname: (userId: number) => string,
): Promise<void> {
  switch (event?.type) {
    // stage_invite, mod_invite, mod_accepted, mod_removed, and mod_unmuted are
    // pushed on the IM socket too — ImBootstrapService is the sole handler for
    // them (see docs/superpowers/specs/2026-07-01-notification-ux-design.md §2).
    case 'stage_raisehand': {
      if (!isHost || event.raisehandType !== 1 || !cname) break;
      const raiserId = Number(event.userId);
      const nickname = getNickname(raiserId);
      toast.action(`${nickname} wants to join the stage`, [
        {
          label: 'Approve',
          variant: 'primary',
          run: () => {
            void firstValueFrom(api.raiseHandApproval(cname, busiType, raiserId, 1)).then(() =>
              toast.success(`${nickname} approved`),
            );
          },
        },
        { label: 'Dismiss', run: () => {} },
      ]);
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
    case 'lucky_bag':
      toast.info('A lucky bag appeared in the room!');
      break;
    default:
      break;
  }
}
