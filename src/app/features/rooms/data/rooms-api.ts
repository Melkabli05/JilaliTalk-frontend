import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ChannelListResponse,
  Category,
  LanguageGroup,
  RoomType,
} from './rooms-model';
import { API_BASE_URL } from '@core/tokens/api-base-url.token';
import { CategoriesService } from '@shared/data/categories.service';

@Injectable()
export class RoomsApi {
  private readonly http = inject(HttpClient);
  private readonly categoriesService = inject(CategoriesService);
  private readonly baseUrl = `${inject(API_BASE_URL)}/rooms`;

  listRooms(
    type: RoomType,
    langId = 0,
    limit = 20,
    offset = 0,
    refresh = 1,
  ): Observable<ChannelListResponse> {
    const params = new HttpParams()
      .set('langId', langId)
      .set('limit', limit)
      .set('offset', offset)
      .set('refresh', refresh);

    return this.http.get<ChannelListResponse>(`${this.baseUrl}/${type}`, { params });
  }

  listLiveRooms(
    langId = 0,
    limit = 20,
    offset = 0,
    refresh = 1,
  ): Observable<ChannelListResponse> {
    const params = new HttpParams()
      .set('langId', langId)
      .set('limit', limit)
      .set('offset', offset)
      .set('refresh', refresh);

    return this.http.get<ChannelListResponse>(`${this.baseUrl}/live`, { params });
  }

  searchRooms(
    type: RoomType,
    query: string,
    langId = 0,
    maxPages = 5,
  ): Observable<ChannelListResponse> {
    const params = new HttpParams()
      .set('query', query)
      .set('langId', langId)
      .set('maxPages', maxPages);

    return this.http.get<ChannelListResponse>(`${this.baseUrl}/${type}/search`, { params });
  }

  recommendRooms(
    type: RoomType,
    excludeCname?: string,
    scene: string = type === 'voice' ? 'in_room' : 'moment_tab',
  ): Observable<ChannelListResponse> {
    let params = new HttpParams().set('scene', scene);
    if (excludeCname) {
      params = params.set('excludeCname', excludeCname);
    }

    return this.http.get<ChannelListResponse>(`${this.baseUrl}/${type}/recommend`, {
      params,
    });
  }

  recommendLiveRooms(
    scene = 'moment_tab',
  ): Observable<ChannelListResponse> {
    const params = new HttpParams().set('scene', scene);

    return this.http.get<ChannelListResponse>(`${this.baseUrl}/live/recommend`, { params });
  }

  getLanguageGroups(
    type: RoomType,
    scene = 'create',
  ): Observable<LanguageGroup[]> {
    const params = new HttpParams().set('scene', scene);

    return this.http.get<LanguageGroup[]>(`${this.baseUrl}/language-groups/${type}`, {
      params,
    });
  }

  fetchCategories(busiType = 2): Observable<readonly Category[]> {
    return this.categoriesService.fetchCategories(busiType);
  }
}