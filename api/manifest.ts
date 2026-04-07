import type { VercelRequest, VercelResponse } from "@vercel/node";
import { list, put } from "@vercel/blob";
import { isAuthorized } from "./_auth.js";
import type { Manifest } from "../src/lib/types.js";

const MANIFEST_KEY = "taste/manifest.json";

async function readManifest(): Promise<Manifest> {
  const blobs = await list({ prefix: MANIFEST_KEY });
  const match = blobs.blobs.find((b) => b.pathname === MANIFEST_KEY);
  if (!match) return { items: [] };
  const res = await fetch(match.url);
  return (await res.json()) as Manifest;
}

async function writeManifest(data: Manifest): Promise<void> {
  await put(MANIFEST_KEY, JSON.stringify(data, null, 2), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
  });
}

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
