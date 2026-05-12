import type { ApiRequest, ApiResponse } from "./_types.js";
import { isAuthorized } from "./_auth.js";
import { errorPayload, HttpError, statusForError } from "./_errors.js";
import { normalizeItemPatch } from "./_input.js";
import { mergeLegacyManifestPut, mutateManifest } from "./_manifest.js";
import { readManifest } from "./_storage.js";
import type { Manifest, TasteItem } from "../src/lib/types.js";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method === "GET") {
    const manifest = await readManifest();
    return res.json(manifest);
  }

  if (req.method === "PUT") {
    if (!isAuthorized(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const manifest = await mergeLegacyManifestPut(req.body as Manifest);
      return res.json({ ok: true, manifest });
    } catch (error) {
      return res.status(statusForError(error)).json(errorPayload(error));
    }
  }

  if (req.method === "PATCH") {
    if (!isAuthorized(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id, patch } = req.body as { id?: unknown; patch?: unknown };
    if (typeof id !== "string" || !id) {
      return res.status(400).json({ error: "Expected { id, patch }" });
    }

    try {
      const normalizedPatch = normalizeItemPatch(patch);
      const item = await mutateManifest((manifest) => {
        let updated: TasteItem | null = null;
        const items = manifest.items.map((existing) => {
          if (existing.id !== id) return existing;
          updated = { ...existing, ...normalizedPatch, id: existing.id };
          return updated;
        });
        if (!updated) {
          throw new HttpError(404, "Item not found", "item_not_found");
        }
        return { manifest: { items }, result: updated };
      });

      return res.json(item);
    } catch (error) {
      return res.status(statusForError(error)).json(errorPayload(error));
    }
  }

  res.setHeader("Allow", "GET, PUT, PATCH");
  return res.status(405).json({ error: "Method not allowed" });
}
