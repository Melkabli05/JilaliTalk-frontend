import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, shareReplay, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { API_V2_BASE_URL } from '@core/tokens/api-v2-base-url.token';
import { Category } from './categories';

interface CategoryTopicListResponse {
  readonly items: Category[];
}

/** Voice rooms are busiType 2 in LiveHub; live rooms are busiType 1. */
const DEFAULT_BUSI_TYPE = 2;

/**
 * Single shared source for `GET /rooms/categories`, cached per `busiType` for the app's
 * lifetime (the BFF itself already serves this from a 6h `@Cacheable`, so this is purely
 * about not re-issuing redundant HTTP round trips from multiple independent call sites —
 * header.component.ts and RoomsStore each used to fetch this independently).
 */
@Injectable({ providedIn: 'root' })
export class CategoriesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(API_V2_BASE_URL)}/rooms`;
  private readonly cache = new Map<number, Observable<readonly Category[]>>();

  fetchCategories(busiType: number = DEFAULT_BUSI_TYPE): Observable<readonly Category[]> {
    let cached = this.cache.get(busiType);
    if (!cached) {
      cached = this.http
        .get<CategoryTopicListResponse>(`${this.baseUrl}/categories`, {
          params: new HttpParams().set('busiType', busiType),
        })
        .pipe(
          map((res) => res.items),
          catchError((err) => {
            this.cache.delete(busiType);
            return throwError(() => err);
          }),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
      this.cache.set(busiType, cached);
    }
    return cached;
  }
}
