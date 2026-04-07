import type { IncomingMessage } from "node:http";

export function isAuthorized(req: IncomingMessage): boolean {
  const key = process.env.TASTE_API_KEY;
  if (!key) return true; // no key configured = open (local dev)

  // Allow requests with valid API key
  const auth = req.headers.authorization;
  if (auth === `Bearer ${key}`) return true;

  // Allow same-origin requests (browser frontend)
  const origin = req.headers.origin ?? "";
  const referer = req.headers.referer ?? "";
  const host = req.headers.host ?? "";
  if (origin && (origin.includes(host) || origin.includes("taste-canvas"))) return true;
  if (referer && (referer.includes(host) || referer.includes("taste-canvas"))) return true;

  return false;
}
