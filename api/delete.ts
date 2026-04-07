import type { VercelRequest, VercelResponse } from "@vercel/node";
import { put, del, list } from "@vercel/blob";
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
  if (req.method !== "DELETE") {
    res.setHeader("Allow", "DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const id = req.query.id as string;
  if (!id) {
    return res.status(400).json({ error: "Missing id query parameter" });
  }

  const manifest = await readManifest();
  const item = manifest.items.find((i) => i.id === id);

  if (!item) {
    return res.status(404).json({ error: "Item not found" });
  }

  // Delete blob image if it's a full URL
  if (item.image.startsWith("http")) {
    try {
      await del(item.image);
    } catch {
      // Image may already be deleted, continue
    }
  }

  manifest.items = manifest.items.filter((i) => i.id !== id);
  await writeManifest(manifest);

  return res.json({ ok: true });
}
