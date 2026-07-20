import { firstValueFrom } from 'rxjs';
import type { ToastService } from '@core/services/toast.service';
import type { RoomApi } from '../api/room-api';
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
              toast.success(`${nickname} is now on stage`),
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
    // Type 47 — a topic/category card was shared into the room. No topic route exists yet,
    // so this is informational only — no "Open" action until there's somewhere real to send
    // the user (a button that does nothing is worse than no button).
    case 'room_topic_share':
      toast.info(`New topic: ${event.name || 'Untitled'}`);
      break;
    // Type 7 — a user applied a cosmetic bubble skin.
    case 'room_props_applied': {
      if (Number(event.userId) === userId) break; // skip self — the local skin already updated
      const nickname = getNickname(Number(event.userId));
      toast.info(`${nickname} changed their chat bubble`);
      break;
    }
    // Gift-wish progress ticks continuously — EventFeedStore already turns milestone
    // crossings (25/50/75/100%) into an event card; no toast needed on top of that.
    case 'gift_wish':
      break;
    // VIP-purchase banner — the room just saw someone buy VIP; show a celebratory toast.
    case 'purchase_vip':
      if (event.title) toast.success(event.title);
      break;
    // VIP-gift received — sender gifted VIP to the recipient; show a thank-you toast.
    case 'receive_vip_gifts':
      if (event.sendNickName) toast.info(`${event.sendNickName} sent you a VIP gift!`);
      break;
    // FG (family group) tier-upgrade — the user just leveled up their FG tier. Toast the content.
    case 'fg_upgrade_award':
      if (event.content) toast.success(event.content);
      break;
    // Treasure / camp reward popup — the big colored show popup. Surfacing the title is
    // enough for now; a future UI component will render the full popup.
    case 'treasure_reward':
      if (event.title) toast.info(event.title);
      break;
    // reward_info (per-user reward envelope) has no UI surface yet — it needs a dedicated
    // reward-strip component (avatar + horizontal Reward thumbnails), not a single-line
    // toast or event card. Deferred until that component exists.
    default:
      break;
  }
}
