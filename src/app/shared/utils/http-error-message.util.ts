import { HttpErrorResponse } from '@angular/common/http';

/** Extracts a backend-provided message from a failed HttpClient call — jilalibff's error
 *  responses are `{ message: string }` — falling back to a generic message for anything
 *  that isn't shaped that way (network failure, unexpected body, etc). */
export function httpErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    const body: unknown = err.error;
    if (body && typeof body === 'object' && 'message' in body && typeof body.message === 'string') {
      return body.message;
    }
  }
  return fallback;
}
