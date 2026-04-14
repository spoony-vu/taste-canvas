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

  const addItem = useCallback((item: TasteItem) => {
    setManifest((prev) => {
      const next = { items: [item, ...prev.items] };
      cachedManifest = next;
      return next;
    });
  }, []);

  const addItems = useCallback((items: TasteItem[]) => {
    setManifest((prev) => {
      const next = { items: [...items, ...prev.items] };
      cachedManifest = next;
      return next;
    });
  }, []);

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
    const res = await fetch(`/api/delete?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) {
      console.error("Delete failed:", res.status, await res.text());
    }
  }, []);

  /** Re-insert an item locally and on the server. */
  const restoreItem = useCallback(async (item: TasteItem) => {
    setManifest((prev) => {
      const next = { items: [item, ...prev.items] };
      cachedManifest = next;
      return next;
    });
    const res = await fetch("/api/manifest");
    const data = (await res.json()) as Manifest;
    data.items.unshift(item);
    await fetch("/api/manifest", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  }, []);

  const updateItem = useCallback(async (id: string, patch: Partial<TasteItem>) => {
    setManifest((prev) => {
      const next = {
        items: prev.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
      };
      cachedManifest = next;
      return next;
    });
    const res = await fetch("/api/manifest");
    const data = (await res.json()) as Manifest;
    data.items = data.items.map((i) => (i.id === id ? { ...i, ...patch } : i));
    await fetch("/api/manifest", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  }, []);

  return { manifest, loading, addItem, addItems, removeItem, confirmDelete, restoreItem, updateItem, refetch: fetchManifest };
}
