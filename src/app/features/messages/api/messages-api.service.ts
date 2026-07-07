import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@core/tokens/api-base-url.token';

/**
 * Thin HTTP mirror of the legacy {@code prvgmsgpacket.js} send-side primitives — the BFF
 * expects the same three shape classes the old client emitted:
 *
 * <ul>
 *   <li>{@link postReadReceipt}   → {@code POST /api/im/messages/{userId}/read}
 *   <li>{@link postTyping}        → {@code POST /api/im/messages/{userId}/typing}
 *   <li>{@link postSendMessage}   → {@code POST /api/im/messages/{userId}/send}
 * </ul>
 *
 * Every method is a one-shot fire-and-forget POST — the BFF drops the call into the
 * {@code HtImUpstreamConnector} send queue, no response payload is read. Errors are swallowed
 * (subscribe-with-no-error) on the calling site because the caller (composer) isn't surfacing
 * "did your DM reach upstream" in any visible state.
 */

export type DmKind = 'text' | 'image' | 'voice_room' | 'live_link' | 'introduction' | 'send_gift';

export interface ReadReceiptBody {
  msgId: string;
}

export interface TypingBody {
  typing: boolean;
}

export interface SendDmBody {
  kind: DmKind;
  msgId?: string;
  fromId?: number;
  fromNickname?: string;
  fromProfileTs?: number;
  text?: string;
  // image fields
  url?: string;
  localPath?: string;
  size?: number;
  width?: number;
  height?: number;
  mimeType?: string;
  // voice_room / live_link / introduction
  roomData?: unknown;
  // send_gift
  gift?: unknown;
}

@Injectable({ providedIn: 'root' })
export class MessagesApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(API_BASE_URL)}/im/messages`;

  postReadReceipt(userId: number, msgId: string): Observable<void> {
    const body: ReadReceiptBody = { msgId };
    return this.http.post<void>(`${this.baseUrl}/${userId}/read`, body);
  }

  postTyping(userId: number, isTyping: boolean): Observable<void> {
    const body: TypingBody = { typing: isTyping };
    return this.http.post<void>(`${this.baseUrl}/${userId}/typing`, body);
  }

  postSendMessage(userId: number, body: SendDmBody): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${userId}/send`, body);
  }
}
