import { HttpErrorResponse } from '@angular/common/http';

function stringField(body: object, field: string): string | null {
  return field in body && typeof (body as Record<string, unknown>)[field] === 'string'
    ? (body as Record<string, unknown>)[field] as string
    : null;
}

/** Extracts a backend-provided message from a failed HttpClient call. jilalibff's own error
 *  responses (GlobalErrorHandler.java → ApiError) are RFC 9457 `application/problem+json`:
 *  `{ type, title, status, detail, upstreamCode }` — the human-readable text is `detail`, not
 *  `message`. A bare `{ message: string }` shape can still occur for framework-level failures
 *  that never reach our handler (e.g. Micronaut's own built-in validation-error body for a
 *  malformed request), so that's checked as a fallback before giving up to the generic message. */
export function httpErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    const body: unknown = err.error;
    if (body && typeof body === 'object') {
      const detail = stringField(body, 'detail');
      if (detail) return detail;
      const message = stringField(body, 'message');
      if (message) return message;
    }
  }
  return fallback;
}
