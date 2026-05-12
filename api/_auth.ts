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
 * If TASTE_API_KEY is unset, unauthenticated writes are allowed only in local
 * development. Vercel/prod-like runtimes fail closed so a missing env var
 * cannot silently expose write endpoints.
 */
export function isAuthorized(req: IncomingMessage): boolean {
  const key = process.env.TASTE_API_KEY;
  if (!key) return allowsUnauthenticatedLocalWrites();

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

function allowsUnauthenticatedLocalWrites(): boolean {
  return process.env.VERCEL !== "1" && process.env.NODE_ENV !== "production";
}

function safeHost(value: string | string[] | undefined): string | null {
  if (!value || Array.isArray(value)) return null;
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}
