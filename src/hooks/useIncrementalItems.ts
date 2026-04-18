import { useState, useCallback, useRef } from "react";

const DEFAULT_BATCH = 24;
const ROOT_MARGIN = "400px";

export function useIncrementalItems<T>(
  allItems: T[],
  batchSize = DEFAULT_BATCH
) {
  const [renderedCount, setRenderedCount] = useState(batchSize);
  const [prevItems, setPrevItems] = useState(allItems);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Reset when source array identity changes (filter/search)
  // React-canonical "adjust state during render" pattern — no effect needed
  if (prevItems !== allItems) {
    setPrevItems(allItems);
    setRenderedCount(batchSize);
  }

  const hasMore = renderedCount < allItems.length;

  const loadMore = useCallback(() => {
    setRenderedCount((prev) => Math.min(prev + batchSize, allItems.length));
  }, [batchSize, allItems.length]);

  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (!node) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) loadMore();
        },
        { rootMargin: ROOT_MARGIN }
      );
      observerRef.current.observe(node);
    },
    [loadMore]
  );

  const items = allItems.slice(0, renderedCount);

  return { items, hasMore, sentinelRef };
}
