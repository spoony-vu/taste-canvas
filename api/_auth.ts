import type { IncomingMessage } from "node:http";

export function isAuthorized(req: IncomingMessage): boolean {
  const key = process.env.TASTE_API_KEY;
  if (!key) return true; // no key configured = open (local dev)
  const auth = req.headers.authorization;
  return auth === `Bearer ${key}`;
}
