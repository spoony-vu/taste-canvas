import { useCallback, useSyncExternalStore } from "react";

type Dims = { w: number; h: number };

/** Shared mutable store — survives re-renders, shared across all cards. */
const dims = new Map<string, Dims>();
let version = 0;
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return version;
}

function notify() {
  version++;
  for (const cb of listeners) cb();
}

/**
 * Measures natural image/video dimensions per item id.
 * Returns a stable `getSpan(id)` that calculates the masonry grid-row span,
 * and a `register(id)` callback to call from onLoad / onLoadedData.
 */
export function useImageDimensions(columnWidth: number, rowHeight = 8, gapY = 16) {
  // Subscribe to version changes so CardGrid re-renders when new dims arrive
  useSyncExternalStore(subscribe, getSnapshot);

  const register = useCallback(
    (id: string, el: HTMLImageElement | HTMLVideoElement) => {
      if (dims.has(id)) return;
      const w = el instanceof HTMLVideoElement ? el.videoWidth : el.naturalWidth;
      const h = el instanceof HTMLVideoElement ? el.videoHeight : el.naturalHeight;
      if (w > 0 && h > 0) {
        dims.set(id, { w, h });
        notify();
      }
    },
    []
  );

  const getSpan = useCallback(
    (id: string) => {
      const d = dims.get(id);
      if (!d) return 30; // ~240px default before measurement
      const renderedHeight = (d.h / d.w) * columnWidth;
      return Math.max(1, Math.ceil((renderedHeight + gapY) / rowHeight));
    },
    [columnWidth, rowHeight, gapY]
  );

  return { register, getSpan };
}
