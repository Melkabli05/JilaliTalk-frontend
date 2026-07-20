import { initialsFrom } from '@shared/utils';
import type { EventCard } from '../models/room-model';

export function eventCardAvatarUrl(card: EventCard): string {
  return 'headUrl' in card ? (card.headUrl ?? '') : '';
}

export function eventCardNationality(card: EventCard): string | null {
  return 'nationality' in card ? card.nationality : null;
}

export function eventCardGiftIconUrl(card: EventCard): string {
  return card.kind === 'gift' ? (card.giftIconUrl ?? '') : '';
}

export function eventCardName(card: EventCard): string {
  if (card.kind === 'receive_vip_gifts') return card.sendNickName || 'Someone';
  return 'nickname' in card && card.nickname ? card.nickname : 'Someone';
}

export function eventCardInitials(card: EventCard): string {
  const n = eventCardName(card);
  return n === 'Someone' ? '??' : initialsFrom(n);
}

export function eventCardGiftReceiverInitials(card: EventCard): string {
  if (card.kind !== 'gift' || !card.receiverNickname) return '??';
  return initialsFrom(card.receiverNickname);
}

export function eventCardGiftLabel(card: EventCard): string {
  return card.kind === 'gift' ? card.giftName || 'gift' : '';
}

export function eventCardTag(card: EventCard): string {
  switch (card.kind) {
    case 'follow':
      return card.isFollowBack ? 'followed back' : 'followed you';
    case 'user_join':
      return 'joined';
    case 'user_quit':
      return 'left';
    case 'stage_raisehand':
      return card.isRaised ? 'raised hand' : 'lowered hand';
    case 'whiteboard_activated':
      return 'whiteboard on';
    case 'whiteboard_deactivated':
      return 'whiteboard off';
    case 'mod_accepted':
      return 'now moderating';
    case 'mod_removed':
      return 'mod removed';
    case 'stage_kick':
      return 'stage kick';
    case 'room_kick':
      return 'room kick';
    case 'room_props_applied':
      return 'new bubble';
    case 'receive_vip_gifts':
      return 'sent you a VIP gift';
    default:
      return '';
  }
}
