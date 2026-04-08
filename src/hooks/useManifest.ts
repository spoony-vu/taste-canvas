import { useState, useEffect, useCallback } from "react";
import type { Manifest, TasteItem } from "../lib/types";

// Module-level cache — survives component remounts within SPA session
let cachedManifest: Manifest | null = null;

export function useManifest() {
  const [manifest, setManifest] = useState<Manifest>(
    cachedManifest ?? { items: [] }
  );
  const [loading, setLoading] = useState(!cachedManifest);

  const fetchManifest = useCallback(async () => {
    const res = await fetch("/api/manifest");
    const data = await res.json();
    cachedManifest = data;
    setManifest(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (cachedManifest) {
      setManifest(cachedManifest);
      setLoading(false);
      fetchManifest();
    } else {
      fetchManifest();
    }
  }, [fetchManifest]);

  const addItem = useCallback(
    async (item: TasteItem) => {
      const next = { items: [item, ...manifest.items] };
      cachedManifest = next;
      setManifest(next);
    },
    [manifest]
  );

  /** Optimistically remove item from state. Returns the removed item for undo. */
  const removeItem = useCallback(
    (id: string): TasteItem | undefined => {
      const item = manifest.items.find((i) => i.id === id);
      setManifest((prev) => {
        const next = { items: prev.items.filter((i) => i.id !== id) };
        cachedManifest = next;
        return next;
      });
      return item;
    },
    [manifest.items]
  );

  /** Fire the actual DELETE API call. */
  const confirmDelete = useCallback(async (id: string) => {
    await fetch(`/api/delete?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  }, []);

  /** Re-insert an item at its original position (best-effort: prepend). */
  const restoreItem = useCallback((item: TasteItem) => {
    setManifest((prev) => {
      const next = { items: [item, ...prev.items] };
      cachedManifest = next;
      return next;
    });
  }, []);

  return { manifest, loading, addItem, removeItem, confirmDelete, restoreItem, refetch: fetchManifest };
}
