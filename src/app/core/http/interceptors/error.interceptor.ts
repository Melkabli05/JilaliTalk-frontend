import { HttpInterceptorFn, HttpRequest, HttpErrorResponse, HttpContextToken } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, retry, timer, throwError } from 'rxjs';

export const SKIP_AUTH_REDIRECT = new HttpContextToken<boolean>(() => false);

const TRANSIENT_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const MAX_RETRIES = 2;

function isIdempotent(req: HttpRequest<unknown>): boolean {
  return ['GET', 'HEAD', 'OPTIONS'].includes(req.method);
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  return next(req).pipe(
    retry({
      delay: (err: unknown, retryCount: number) => {
        const transient =
          err instanceof HttpErrorResponse && TRANSIENT_STATUSES.has(err.status);
        if (!transient || !isIdempotent(req) || retryCount > MAX_RETRIES) {
          throw err;
        }
        return timer(Math.pow(2, retryCount - 1) * 1000);
      },
    }),
    catchError((err: HttpErrorResponse) => {
      // Only session-level failures get centralized navigation. Everything else
      // (404, 5xx, network) is re-thrown for the calling feature to surface in
      // place — a failing background call (heartbeat, roster refresh) must never
      // eject the user to a full-page error while the app is otherwise working.
      //
      // /api/auth/* is excluded entirely: a 401 there means "bad credentials" (login)
      // or "no session yet" (boot-time me() check) — both expected, both handled inline
      // by the caller, never a reason to yank the whole app to a full-page error.
      const skipRedirect = req.context.get(SKIP_AUTH_REDIRECT);
      if (!skipRedirect) {
        if (err.status === 401) {
          void router.navigate(['/error/401']);
        } else if (err.status === 403) {
          void router.navigate(['/error/403']);
        }
      }
      return throwError(() => err);
    }),
  );
};
