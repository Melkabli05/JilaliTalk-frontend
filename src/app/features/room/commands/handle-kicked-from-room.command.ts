import { ToastService } from '@core/services/toast.service';
import { NotificationReporter } from '@core/tokens/notification-reporter.token';
import { RoomStore } from '../store/room-store';
import { RoomRosterStore } from '../roster/roster-store';
import { buildKickedFromRoomOutcome, resolveManagerIdentity } from '../utils/kicked-from-room.util';

/**
 * Reacts to a `room_kick` event targeting the current user: goes invisible locally when
 * they were visible (moderators can still see/re-invite an invisible ghost — only a
 * visible member needs to be pulled out), then surfaces a toast + notification. The
 * manager's identity is best-effort — `room_kick` only carries a display name, so
 * `resolveManagerIdentity` matches it against the current roster.
 */
export async function handleKickedFromRoom(
  managerName: string,
  cname: string | null,
  busiType: number,
  roomStore: RoomStore,
  rosterStore: RoomRosterStore,
  toast: ToastService,
  notifications: NotificationReporter,
  goInvisibleLocally: (cname: string, busiType: number) => Promise<void>,
): Promise<void> {
  const outcome = buildKickedFromRoomOutcome(managerName, roomStore.name(), roomStore.isVisible());
  const identity = resolveManagerIdentity(managerName, rosterStore.stageUsers(), rosterStore.audienceUsers());

  if (outcome.shouldGoInvisible && cname) {
    await goInvisibleLocally(cname, busiType);
  }

  toast.warning(outcome.toastMessage);
  if (identity) {
    notifications.notifyUserEvent({
      type: 'warning',
      title: outcome.notificationTitle,
      message: outcome.notificationMessage,
      userId: identity.userId,
      avatarUrl: identity.avatarUrl,
      nickname: managerName,
    });
  } else {
    notifications.notify('warning', outcome.notificationTitle, outcome.notificationMessage);
  }
}
