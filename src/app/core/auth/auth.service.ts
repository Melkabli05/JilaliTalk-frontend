import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthUser } from './auth.store';
import { API_BASE_URL } from '@core/tokens/api-base-url.token';
import { SKIP_AUTH_REDIRECT } from '@core/http/interceptors/error.interceptor';

export interface LoginRequest {
  readonly email: string;
  readonly password: string;
}

export interface RegisterRequest {
  readonly email: string;
  readonly password: string;
  readonly nickname: string;
}

export interface AuthResponse {
  readonly user: AuthUser;
}

/**
 * Talks to jilalibff's platform-auth controller (com.jilali.auth.AuthController). The
 * session itself is an HttpOnly cookie the backend sets/clears on these calls — the
 * frontend never sees a token, only the resulting {@link AuthUser}. Same-origin in both
 * dev (via proxy.conf.json) and prod, so the cookie travels with no extra request config.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  login(req: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/login`, req, { context: new HttpContext().set(SKIP_AUTH_REDIRECT, true) });
  }

  register(req: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/register`, req, { context: new HttpContext().set(SKIP_AUTH_REDIRECT, true) });
  }

  /** Resolves the current session from its cookie — 401 means simply "not logged in". */
  me(): Observable<AuthResponse> {
    return this.http.get<AuthResponse>(`${this.baseUrl}/auth/me`, { context: new HttpContext().set(SKIP_AUTH_REDIRECT, true) });
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/auth/logout`, {}, { context: new HttpContext().set(SKIP_AUTH_REDIRECT, true) });
  }
}