import { useState, useEffect, useCallback } from "react";
import type { Manifest, TasteItem } from "../lib/types";

export function useManifest() {
  const [manifest, setManifest] = useState<Manifest>({ items: [] });
  const [loading, setLoading] = useState(true);

  const fetchManifest = useCallback(async () => {
    const res = await fetch("/api/manifest");
    const data = await res.json();
    setManifest(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchManifest();
  }, [fetchManifest]);

  const addItem = useCallback(
    async (item: TasteItem) => {
      const next = { items: [item, ...manifest.items] };
      setManifest(next);
    },
    [manifest]
  );

  const removeItem = useCallback(
    async (id: string) => {
      await fetch(`/api/manifest/${id}`, { method: "DELETE" });
      setManifest((prev) => ({
        items: prev.items.filter((item) => item.id !== id),
      }));
    },
    []
  );

  return { manifest, loading, addItem, removeItem, refetch: fetchManifest };
}
