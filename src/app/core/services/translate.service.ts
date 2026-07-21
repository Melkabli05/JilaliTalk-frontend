import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_V2_BASE_URL } from '@core/tokens/api-v2-base-url.token';

export interface TranslateResult {
  readonly translatedText: string;
}

@Injectable({ providedIn: 'root' })
export class TranslateService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_V2_BASE_URL);

  translate(text: string): Observable<TranslateResult> {
    return this.http.post<TranslateResult>(`${this.base}/translate`, {
      text,
      targetLang: 'ar',
    });
  }
}