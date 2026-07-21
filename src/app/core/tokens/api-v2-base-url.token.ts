import { InjectionToken } from '@angular/core';

/**
 * Base URL for the new `roomcontext` bounded-context endpoints, which the backend mounts under
 * `/api/v2/*` so they can coexist with the legacy `/api/*` controllers during the migration
 * window. Derived from the same origin as {@link API_BASE_URL} (see app.config.ts) — mirrors the
 * API_BASE_URL / WS_BASE_URL pattern.
 *
 * Transitional: once the backend cuts the roomcontext feature over to `/api` (its Phase 5), this
 * token's provider collapses back to the plain apiUrl and can be retired — a single-line change
 * here rather than an edit at every call site.
 */
export const API_V2_BASE_URL = new InjectionToken<string>('API_V2_BASE_URL', {
  factory: () => '/api/v2',
});
