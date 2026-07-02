import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { StageUsersResponse, AudienceUsersResponse, CommentsResponse, SendCommentPayload, VoiceSignPanelResponse, RoomLevelRewardResponse, RoomLevelConfigResponse, VoiceRoomInfo, LiveRoomInfo, ManagerListResponse, ManagerJudgeResponse, CaptionHistoryResponse, VoiceTasksResponse } from './room-model';
import { API_BASE_URL } from '@core/tokens/api-base-url.token';

@Injectable({ providedIn: 'root' })
export class RoomApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  fetchVoiceRoomInfo(cname: string): Observable<VoiceRoomInfo> {
    return this.http.get<VoiceRoomInfo>(`${this.baseUrl}/rooms/voice/${cname}`);
  }

  fetchLiveRoomInfo(cname: string): Observable<LiveRoomInfo> {
    return this.http.get<LiveRoomInfo>(`${this.baseUrl}/rooms/live/${cname}`);
  }

  fetchStageUsers(cname: string, busiType: number): Observable<StageUsersResponse> {
    const params = new HttpParams()
      .set('cname', cname)
      .set('busiType', busiType);

    return this.http.get<StageUsersResponse>(`${this.baseUrl}/stage/list`, { params });
  }

  fetchAudienceUsers(
    cname: string,
    busiType: number,
    offset = 0,
    limit = 50,
  ): Observable<AudienceUsersResponse> {
    return this.http.post<AudienceUsersResponse>(
      `${this.baseUrl}/users/rooms/list`,
      { cname, busi_type: busiType, get_type: [3], limit, offset },
    );
  }

  /** Returns the current audience roster revision — poll this to decide whether to refetch. */
  fetchAudienceRevision(cname: string): Observable<{ revision: number }> {
    return this.http.get<{ revision: number }>(`${this.baseUrl}/rooms/${cname}/audience-revision`);
  }

  fetchComments(cname: string, busiType: number): Observable<CommentsResponse> {
    const params = new HttpParams()
      .set('cname', cname)
      .set('busiType', busiType);

    return this.http
      .get<CommentsResponse>(`${this.baseUrl}/comments`, { params })
      .pipe(
        map((res) => ({
          ...res,
          items: res.items?.map((c) => ({ ...c, createdAt: c.createdAt * 1000 })) ?? null,
        })),
      );
  }

  sendComment(payload: SendCommentPayload): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/comments`, payload);
  }

  joinRoom(cname: string, busiType: number): Observable<void> {
    return this.http
      .post<void>(`${this.baseUrl}/users/rooms/${cname}/join?busiType=${busiType}`, null);
  }

  claimVipTrial(): Observable<boolean> {
    return this.http
      .post<{ claimed: boolean }>(`${this.baseUrl}/vip-experience-card/claim-trial`, null)
      .pipe(map((res) => res.claimed));
  }

  leaveRoom(cname: string, busiType: number): Observable<void> {
    return this.http
      .post<void>(`${this.baseUrl}/users/rooms/${cname}/quit?busiType=${busiType}`, null);
  }

  kickFromStage(cname: string, busiType: number, userId: number): Observable<void> {
    return this.http
      .post<void>(
        `${this.baseUrl}/stage/kick`,
        { cname, busi_type: busiType, user_id: userId },
      );
  }

  raiseHand(cname: string, busiType: number, raisehandType: 1 | 2): Observable<void> {
    return this.http
      .post<void>(
        `${this.baseUrl}/stage/raise-hand`,
        { cname, busi_type: busiType, raisehand_type: raisehandType },
      );
  }

  fetchPublisherToken(cname: string): Observable<{ token: string }> {
    return this.http.get<{ token: string }>(`${this.baseUrl}/stage/publisher-token`, {
      params: { cname },
    });
  }

  muteUser(cname: string, busiType: number, userId: number, mute: boolean): Observable<void> {
    return this.http
      .post<void>(
        `${this.baseUrl}/stage/device-control`,
        {
          cname,
          busi_type: busiType,
          user_id: userId,
          device_type: 1,
          switch_type: mute ? 2 : 1,
        },
      );
  }

  inviteToStage(cname: string, busiType: number, userId: number): Observable<void> {
    return this.http
      .post<void>(
        `${this.baseUrl}/stage/invite`,
        { cname, busi_type: busiType, user_id: userId, invite_type: 3 },
      );
  }

  joinStage(cname: string, busiType: number): Observable<void> {
    return this.http
      .post<void>(
        `${this.baseUrl}/stage/join`,
        { cname, busi_type: busiType },
      );
  }

  leaveStage(cname: string, busiType: number): Observable<void> {
    return this.http
      .post<void>(
        `${this.baseUrl}/stage/quit`,
        { cname, busi_type: busiType },
      );
  }

  setManager(cname: string, busiType: number, userId: number, action: 1 | 2): Observable<void> {
    return this.http
      .post<void>(
        `${this.baseUrl}/managers`,
        { cname, busi_type: busiType, user_id: userId, action },
      );
  }

  approveManager(cname: string, hostId: number): Observable<void> {
    return this.http
      .post<void>(
        `${this.baseUrl}/managers/approve`,
        { operation_type: 'RoomManagerAgree', cname, host_id: hostId },
      );
  }

  judgeManager(cname: string, hostId: number): Observable<ManagerJudgeResponse> {
    const params = new HttpParams().set('cname', cname).set('host_id', hostId);
    return this.http.get<ManagerJudgeResponse>(`${this.baseUrl}/managers/judge`, { params });
  }

  listManagers(cname: string, hostId: number): Observable<ManagerListResponse> {
    const params = new HttpParams().set('cname', cname).set('host_id', hostId);
    return this.http.get<ManagerListResponse>(`${this.baseUrl}/managers`, { params });
  }

  raiseHandApproval(cname: string, busiType: number, userId: number, approvalType: 1 | 2): Observable<void> {
    return this.http
      .post<void>(
        `${this.baseUrl}/stage/raise-hand/approval`,
        { cname, busi_type: busiType, user_id: userId, approval_type: approvalType },
      );
  }

  stageInviteApproval(cname: string, busiType: number, inviteType: number, approvalType: 1 | 2): Observable<void> {
    return this.http
      .post<void>(
        `${this.baseUrl}/stage/invite/approval`,
        { cname, busi_type: busiType, invite_type: inviteType, approval_type: approvalType },
      );
  }

  fetchCaptionHistory(cname: string, busiType: number, pageSize = 20): Observable<CaptionHistoryResponse> {
    const params = new HttpParams().set('cname', cname).set('busiType', busiType).set('pageSize', pageSize);
    return this.http.get<CaptionHistoryResponse>(`${this.baseUrl}/captions/history`, { params });
  }

  toggleCaption(cname: string, busiType: number, captionStatus: 1 | 2): Observable<void> {
    return this.http
      .post<void>(
        `${this.baseUrl}/captions/switch`,
        { cname, busi_type: busiType, caption_status: captionStatus, is_try_out: false },
      );
  }

  fetchSignPanel(cname: string): Observable<VoiceSignPanelResponse> {
    const params = new HttpParams().set('cname', cname);
    return this.http.get<VoiceSignPanelResponse>(`${this.baseUrl}/signin/panel`, { params });
  }

  fetchTasks(): Observable<VoiceTasksResponse> {
    return this.http.get<VoiceTasksResponse>(`${this.baseUrl}/signin/tasks`);
  }

  fetchRoomLevelRewards(cname: string, hostId: number, level = 1): Observable<RoomLevelRewardResponse> {
    const params = new HttpParams()
      .set('cname', cname)
      .set('host_id', hostId)
      .set('level', level);
    return this.http.get<RoomLevelRewardResponse>(`${this.baseUrl}/signin/room-level-reward`, { params });
  }

  claimRoomLevelReward(cname: string, hostId: number): Observable<void> {
    return this.http
      .post<void>(
        `${this.baseUrl}/signin/room-level-reward`,
        { cname, host_id: hostId },
      );
  }

  claimTaskReward(cname: string, hostId: number, taskId: number): Observable<void> {
    return this.http
      .post<void>(
        `${this.baseUrl}/signin/task-reward`,
        { cname, host_id: hostId, task_id: taskId },
      );
  }

  fetchRoomLevelConfig(cname: string, hostId: number): Observable<RoomLevelConfigResponse> {
    const params = new HttpParams().set('cname', cname).set('host_id', hostId);
    return this.http.get<RoomLevelConfigResponse>(`${this.baseUrl}/signin/room-level-config`, { params });
  }
}
