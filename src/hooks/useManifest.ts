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
      // Show cached immediately, refetch in background
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

  const removeItem = useCallback(
    async (id: string) => {
      await fetch(`/api/manifest/${id}`, { method: "DELETE" });
      setManifest((prev) => {
        const next = { items: prev.items.filter((item) => item.id !== id) };
        cachedManifest = next;
        return next;
      });
    },
    []
  );

  return { manifest, loading, addItem, removeItem, refetch: fetchManifest };
}
