import { firstValueFrom } from 'rxjs';
import { RoomApi } from '../api/room-api';
import { ToastService } from '@core/services/toast.service';

/**
 * The "go invisible via the toggle button" flow: tells the backend the user left the
 * roster (unlike goInvisibleLocally, which has no REST call — see go-invisible.command.ts),
 * then applies the same local invisible-state side effects.
 */
export async function makeInvisible(
  cname: string,
  busiType: number,
  api: RoomApi,
  toast: ToastService,
  goInvisibleLocally: (cname: string, busiType: number) => Promise<void>,
): Promise<void> {
  await firstValueFrom(api.leaveRoom(cname, busiType));
  await goInvisibleLocally(cname, busiType);
  toast.info('You are now invisible');
}
