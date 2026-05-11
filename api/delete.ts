import type { ApiRequest, ApiResponse } from "./_types.js";
import { isAuthorized } from "./_auth.js";
import { deleteUnreferencedAssets, ManifestConflictError, removeItem } from "./_manifest.js";

export default async function handler(req: ApiRequest, res: ApiResponse) {
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

  let removed;
  let remaining;
  try {
    ({ removed, remaining } = await removeItem(id));
  } catch (error) {
    if (error instanceof ManifestConflictError) {
      return res.status(404).json({ error: "Item not found" });
    }
    throw error;
  }

  if (!removed) {
    return res.status(404).json({ error: "Item not found" });
  }

  await deleteUnreferencedAssets(removed, remaining);

  return res.json({ ok: true });
}
