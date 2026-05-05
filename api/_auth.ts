import type { IncomingMessage } from "node:http";

/**
 * Authorize a request for write endpoints.
 *
 * Two paths are accepted:
 *  1. Bearer token in Authorization header matching TASTE_API_KEY env var
 *     (used by the browser extension and any external script)
 *  2. Same-origin requests from the deployed frontend (origin/referer host
 *     matches the request's own host header)
 *
 * If TASTE_API_KEY is unset, all requests are allowed — local dev only.
 * In production, ALWAYS set TASTE_API_KEY.
 */
export function isAuthorized(req: IncomingMessage): boolean {
  const key = process.env.TASTE_API_KEY;
  if (!key) return true; // open mode for local dev

  // Bearer token (extension, scripts)
  const auth = req.headers.authorization;
  if (auth === `Bearer ${key}`) return true;

  // Same-origin browser request: origin/referer host must match request host
  const host = req.headers.host ?? "";
  if (!host) return false;

  const originHost = safeHost(req.headers.origin);
  const refererHost = safeHost(req.headers.referer);

  if (originHost && originHost === host) return true;
  if (refererHost && refererHost === host) return true;

  return false;
}

function safeHost(value: string | string[] | undefined): string | null {
  if (!value || Array.isArray(value)) return null;
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}
