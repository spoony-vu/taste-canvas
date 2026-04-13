import { useEffect, useRef, useCallback } from "react";

const DRAG_THRESHOLD = 5;

/**
 * Grab-to-scroll (pan) on the page. When active, clicking and dragging
 * scrolls the viewport. Clicks are suppressed after a drag so cards
 * don't accidentally open the lightbox.
 */
export function useDragToScroll(enabled: boolean) {
  const tracking = useRef(false);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const scrollX = useRef(0);
  const scrollY = useRef(0);

  const onMouseDown = useCallback((e: MouseEvent) => {
    if (e.button !== 0) return;
    // Allow native behavior on actual inputs/links
    const target = e.target as HTMLElement;
    if (target.closest("a, input, select, textarea")) return;

    tracking.current = true;
    dragging.current = false;
    startX.current = e.clientX;
    startY.current = e.clientY;
    scrollX.current = window.scrollX;
    scrollY.current = window.scrollY;
  }, []);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!tracking.current) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;

    if (!dragging.current) {
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        dragging.current = true;
        document.documentElement.style.cursor = "grabbing";
        document.documentElement.style.userSelect = "none";
      }
      return;
    }

    window.scrollTo(scrollX.current - dx, scrollY.current - dy);
  }, []);

  const onMouseUp = useCallback(() => {
    if (!tracking.current) return;
    tracking.current = false;
    document.documentElement.style.cursor = "grab";
    document.documentElement.style.userSelect = "";
  }, []);

  // Capture-phase click suppression after drag
  const onClick = useCallback((e: MouseEvent) => {
    if (dragging.current) {
      e.stopPropagation();
      e.preventDefault();
      dragging.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      document.documentElement.style.cursor = "";
      return;
    }

    document.documentElement.style.cursor = "grab";
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("click", onClick, true);

    return () => {
      document.documentElement.style.cursor = "";
      document.documentElement.style.userSelect = "";
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("click", onClick, true);
    };
  }, [enabled, onMouseDown, onMouseMove, onMouseUp, onClick]);
}
