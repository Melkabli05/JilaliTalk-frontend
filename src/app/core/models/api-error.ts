/** Mirrors the BFF's RFC 9457 problem+json error body (see `ApiError` on the backend). */
export interface ApiError {
  type: string;
  title: string;
  status: number;
  detail: string;
  upstreamCode?: number;
}

/** Upstream Jilali code for "non-VIP daily watch-time budget exhausted". */
export const WATCH_LIMIT_NON_VIP_CODE = 190041;

/** Upstream Jilali code for "area not open to join" (user is region-blocked from this room type). */
export const AREA_NOT_OPEN_CODE = 190024;

/** Upstream Jilali code for "live banned" (user is banned from live rooms). */
export const LIVE_BANNED_CODE = 190039;
