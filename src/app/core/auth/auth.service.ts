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

export interface SignupCheckRequest {
  readonly email: string;
  readonly password: string;
  readonly emailVerifyCode: string;
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

  /** Step 1 (optional, best-effort): mirrors the real app's `reg/prepare` call. Failures here
   *  are never fatal to signup — see jilalibff's HelloTalkAuthService.signupPrepare. */
  signupPrepare(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/auth/signup/prepare`, {}, { context: new HttpContext().set(SKIP_AUTH_REDIRECT, true) });
  }

  /** Step 2: sends the 6-digit email verification code used by {@link signupCheck}. */
  signupSendEmailCode(email: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/auth/signup/send-email-code`, { email }, { context: new HttpContext().set(SKIP_AUTH_REDIRECT, true) });
  }

  /** Terminal step: creates the account and, on success, logs the browser in immediately
   *  (jilalibff runs a real login right after `/v3/check` since that upstream call never
   *  returns a JWT of its own). */
  signupCheck(req: SignupCheckRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/signup/check`, req, { context: new HttpContext().set(SKIP_AUTH_REDIRECT, true) });
  }

  /** Resolves the current session from its cookie — 401 means simply "not logged in". */
  me(): Observable<AuthResponse> {
    return this.http.get<AuthResponse>(`${this.baseUrl}/auth/me`, { context: new HttpContext().set(SKIP_AUTH_REDIRECT, true) });
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/auth/logout`, {}, { context: new HttpContext().set(SKIP_AUTH_REDIRECT, true) });
  }
}