import { createSearchMatcher } from '@shared/utils';
import { ChannelListItem } from './rooms-model';

export function filterRooms(
  rooms: readonly ChannelListItem[],
  categoryId: number | null,
  langId: number | null,
  query: string,
): readonly ChannelListItem[] {
  let filtered = rooms;
  if (categoryId !== null) {
    filtered = filtered.filter((room) => room.categoryTopicTag?.categoryId === categoryId);
  }
  if (langId !== null) {
    filtered = filtered.filter((room) => room.channel.langId === langId);
  }
  if (query.trim()) {
    const matcher = createSearchMatcher(query);
    filtered = filtered
      .filter((room) =>
        matcher.matches([
          room.channel.name,
          room.channel.cname,
          room.channel.description,
          room.hostUser.nickname,
          room.categoryTopicTag?.categoryName,
          room.categoryTopicTag?.topicName,
          ...(room.users?.map((u) => u.nickname) ?? []),
        ]),
      )
      .map((room) => ({ room, rank: matcher.rank([room.channel.name, room.hostUser.nickname]) }))
      .sort((a, b) => a.rank - b.rank)
      .map(({ room }) => room);
  }
  return filtered;
}
