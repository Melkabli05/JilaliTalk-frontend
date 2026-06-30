import { InjectionToken } from '@angular/core';

/**
 * Relative on purpose: the dev server proxies `/api` (and `/ws`) to the local backend
 * (see proxy.conf.json), and a production deployment serves the frontend and BFF behind
 * the same origin. Same-origin requests need no CORS configuration on either side.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  factory: () => '/api',
});