import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isAuthorized } from "./_auth.js";
import { readManifest, writeManifest, deleteBlob } from "./_storage.js";

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

  // Delete blob assets
  const urls = [item.image, item.thumb, item.video].filter(
    (u): u is string => !!u && u.startsWith("http")
  );
  await Promise.all(urls.map(deleteBlob));

  manifest.items = manifest.items.filter((i) => i.id !== id);
  await writeManifest(manifest);

  return res.json({ ok: true });
}
