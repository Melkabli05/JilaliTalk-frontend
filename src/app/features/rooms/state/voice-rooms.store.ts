import { Service } from '@angular/core';
import { Observable } from 'rxjs';
import { RoomListStore } from './room-list.store';
import { ChannelListResponse, RoomType } from '../data/rooms-model';

@Service()
export class VoiceRoomsStore extends RoomListStore {
  readonly busiType = 2;

  protected listRooms(
    type: RoomType,
    langId: number | null,
    limit: number,
    offset: number,
    refresh: number,
  ): Observable<ChannelListResponse> {
    return this.api.listRooms(type, langId ?? 0, limit, offset, refresh);
  }

  protected searchRooms(
    query: string,
    langId: number,
    maxPages: number,
  ): Observable<ChannelListResponse> {
    return this.api.searchRooms(RoomType.Voice, query, langId, maxPages);
  }

  protected recommendRooms(excludeCname?: string): Observable<ChannelListResponse> {
    return this.api.recommendRooms(RoomType.Voice, excludeCname);
  }

  protected get categoryFilterEnabled(): boolean {
    return true;
  }
}
