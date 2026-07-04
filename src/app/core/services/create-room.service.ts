import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@core/tokens/api-base-url.token';
import { RoomVisibility } from '@shared/ui/create-room-modal/create-room-modal.component';
import { Category } from '@shared/data/categories';
import { CategoriesService } from '@shared/data/categories.service';

export interface CreateVoiceRoomRequest {
  readonly name: string;
  readonly langId: number;
  readonly visibility: RoomVisibility;
  readonly notice?: string;
  readonly categoryId?: number | null;
  readonly topicId?: number | null;
}

/** Voice rooms are busiType 2 in LiveHub. */
const VOICE_BUSI_TYPE = 2;

export interface CreateVoiceChannelResponse {
  readonly cname: string;
  readonly token: string | null;
  readonly rtcEngine: number;
}

/** LiveHub `visible_status`: 1 = public, 4 = private (key-locked). */
const VISIBLE_STATUS: Record<RoomVisibility, number> = {
  public: 1,
  private: 4,
};

@Injectable({ providedIn: 'root' })
export class CreateRoomService {
  private readonly http = inject(HttpClient);
  private readonly categoriesService = inject(CategoriesService);
  private readonly baseUrl = `${inject(API_BASE_URL)}/rooms`;

  createVoiceRoom(request: CreateVoiceRoomRequest): Observable<CreateVoiceChannelResponse> {
    return this.http.post<CreateVoiceChannelResponse>(`${this.baseUrl}/voice`, {
      visible_status: VISIBLE_STATUS[request.visibility],
      name: request.name,
      lang_id: request.langId,
      notice: request.notice ?? '',
      game_type: 0,
      category_id_v2: request.categoryId ?? null,
      topic_id_v2: request.topicId ?? null,
    });
  }

  fetchCategories(busiType = VOICE_BUSI_TYPE): Observable<readonly Category[]> {
    return this.categoriesService.fetchCategories(busiType);
  }

  /** Returns the user's currently active voice channel, or null if none exists. */
  fetchActiveChannel(busiType = VOICE_BUSI_TYPE): Observable<{ cname: string } | null> {
    const params = new HttpParams().set('busiType', busiType);
    return this.http.get<{ cname: string } | null>(`${this.baseUrl}/active`, { params });
  }
}
