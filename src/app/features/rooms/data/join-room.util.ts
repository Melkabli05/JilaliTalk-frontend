import { Router } from '@angular/router';
import { ChannelListItem } from './rooms-model';

/**
 * Video rooms (busiType=1) use the /room/video/:cname/:busiType route; voice rooms
 * (busiType=2) use /room/:cname/:busiType. Invisible entry is carried as a query param.
 * Shared by voice-list.ts and live-list.ts, which previously duplicated this identically.
 */
export async function joinRoom(
  router: Router,
  room: ChannelListItem,
  visible: boolean,
  event?: Event,
): Promise<void> {
  event?.stopPropagation();
  if (event?.type === 'keydown') event.preventDefault();

  const cname = room.channel.cname;
  const busiType = room.channel.busiType;

  try {
    const path = busiType === 1 ? '/room/video' : '/room';
    const queryParams = visible ? {} : { visible: 'false' };
    await router.navigate([path, cname, busiType], { queryParams });
  } catch (err) {
    console.error('Failed to join room', err);
  }
}
