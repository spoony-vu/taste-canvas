import { useState, useEffect, useCallback } from "react";
import { markPerf, measurePerf } from "../lib/performance";
import type { Manifest, TasteItem } from "../lib/types";

const SNAPSHOT_KEY = "taste-canvas:manifest-snapshot";

// Module-level cache — survives component remounts within SPA session
let cachedManifest: Manifest | null = null;

function readSnapshot(): Manifest | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Manifest;
    if (!parsed || !Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function cacheManifest(data: Manifest) {
  cachedManifest = data;
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(data));
  } catch {
    // Quota/private-mode failures should not block the source-of-truth sync.
  }
}

const initialManifest = cachedManifest ?? readSnapshot() ?? { items: [] };
const hasInitialManifest = !!cachedManifest || initialManifest.items.length > 0;

export function useManifest() {
  const [manifest, setManifest] = useState<Manifest>(initialManifest);
  const [loading, setLoading] = useState(!hasInitialManifest);
  const [refreshing, setRefreshing] = useState(hasInitialManifest);
  const [syncError, setSyncError] = useState("");

  const fetchManifest = useCallback(async () => {
    setRefreshing(true);
    markPerf("taste:manifest-request-start");
    try {
      const res = await fetch("/api/manifest");
      if (!res.ok) throw new Error(`Manifest fetch failed (${res.status})`);
      const data = (await res.json()) as Manifest;
      cacheManifest(data);
      setManifest(data);
      setSyncError("");
      markPerf("taste:manifest-response");
      measurePerf("taste:manifest-request", "taste:manifest-request-start", "taste:manifest-response");
    } catch (err) {
      setSyncError(String(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchManifest();
  }, [fetchManifest]);

  const addItem = useCallback((item: TasteItem) => {
    setManifest((prev) => {
      const next = { items: [item, ...prev.items] };
      cacheManifest(next);
      return next;
    });
  }, []);

  const addItems = useCallback((items: TasteItem[]) => {
    setManifest((prev) => {
      const next = { items: [...items, ...prev.items] };
      cacheManifest(next);
      return next;
    });
  }, []);

  /** Optimistically remove item from state. Returns the removed item for undo. */
  const removeItem = useCallback(
    (id: string): TasteItem | undefined => {
      const item = manifest.items.find((i) => i.id === id);
      setManifest((prev) => {
        const next = { items: prev.items.filter((i) => i.id !== id) };
        cacheManifest(next);
        return next;
      });
      return item;
    },
    [manifest.items]
  );

  /** Fire the actual DELETE API call. */
  const confirmDelete = useCallback(async (id: string, rollbackItem?: TasteItem) => {
    try {
      const res = await fetch(`/api/delete?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Delete failed (${res.status}): ${text}`);
      }
      setSyncError("");
      return true;
    } catch (err) {
      setSyncError(String(err));
      if (rollbackItem) {
        setManifest((prev) => {
          if (prev.items.some((item) => item.id === rollbackItem.id)) return prev;
          const next = { items: [rollbackItem, ...prev.items] };
          cacheManifest(next);
          return next;
        });
      }
      return false;
    }
  }, []);

  /** Re-insert an item locally before the delayed DELETE is confirmed. */
  const restoreItem = useCallback((item: TasteItem) => {
    setManifest((prev) => {
      if (prev.items.some((existing) => existing.id === item.id)) return prev;
      const next = { items: [item, ...prev.items] };
      cacheManifest(next);
      return next;
    });
  }, []);

  const updateItem = useCallback(async (id: string, patch: Partial<TasteItem>) => {
    let previous: Manifest | null = null;
    setManifest((prev) => {
      previous = prev;
      const next = {
        items: prev.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
      };
      cacheManifest(next);
      return next;
    });
    try {
      const res = await fetch("/api/manifest");
      if (!res.ok) throw new Error(`Manifest refresh failed (${res.status})`);
      const data = (await res.json()) as Manifest;
      data.items = data.items.map((i) => (i.id === id ? { ...i, ...patch } : i));
      const writeRes = await fetch("/api/manifest", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!writeRes.ok) throw new Error(`Update failed (${writeRes.status})`);
      cacheManifest(data);
      setManifest(data);
      setSyncError("");
    } catch (err) {
      setSyncError(String(err));
      if (previous) {
        cacheManifest(previous);
        setManifest(previous);
      }
    }
  }, []);

  const clearSyncError = useCallback(() => setSyncError(""), []);

  return {
    manifest,
    loading,
    refreshing,
    syncError,
    clearSyncError,
    addItem,
    addItems,
    removeItem,
    confirmDelete,
    restoreItem,
    updateItem,
    refetch: fetchManifest,
  };
}
