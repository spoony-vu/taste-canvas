import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isAuthorized } from "./_auth.js";
import { readManifest, writeManifest } from "./_storage.js";
import type { Manifest } from "../src/lib/types.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    const manifest = await readManifest();
    return res.json(manifest);
  }

  if (req.method === "PUT") {
    if (!isAuthorized(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    await writeManifest(req.body as Manifest);
    return res.json({ ok: true });
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).json({ error: "Method not allowed" });
}
