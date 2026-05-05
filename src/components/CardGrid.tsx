import { useState, useEffect, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { TasteCard } from "./TasteCard";
import { useImageDimensions } from "../hooks/useImageDimensions";
import type { LayoutMode, TasteItem } from "../lib/types";

const SKELETON_HEIGHTS = [180, 240, 160, 220, 200, 260, 150, 210];
const SKELETON_COUNT_GRID = 12;
const SKELETON_COUNT_FEED = 4;

const ROW_HEIGHT = 8;
const GAP_Y = 16;

function SkeletonCard({ height, mode }: { height: number; mode: LayoutMode }) {
  if (mode === "grid") {
    return (
      <div
        className="skeleton-shimmer rounded-lg"
        style={{ aspectRatio: "3/2" }}
      />
    );
  }
  if (mode === "feed") {
    return (
      <div className="overflow-hidden rounded-xl">
        <div
          className="skeleton-shimmer"
          style={{ aspectRatio: "16/9" }}
        />
        <div className="flex items-center gap-2 px-1 pt-2.5">
          <div className="skeleton-shimmer h-5 w-16 rounded-full" />
          <div className="skeleton-shimmer h-4 w-32 rounded" />
        </div>
      </div>
    );
  }
  // Masonry skeleton: use grid-row span
  const span = Math.ceil((height + GAP_Y) / ROW_HEIGHT);
  return (
    <div
      className="skeleton-shimmer rounded-xl"
      style={{ gridRow: `span ${span}` }}
    />
  );
}

function useColumnWidth(mode: LayoutMode) {
  const [width, setWidth] = useState(300);

  const measure = useCallback(() => {
    if (mode !== "masonry") return;
    const el = document.querySelector<HTMLElement>(".card-layout");
    if (!el) return;
    const cols = getComputedStyle(el).gridTemplateColumns.split(" ").length;
    const gap = 16;
    const available = el.clientWidth - gap * (cols - 1);
    setWidth(Math.floor(available / cols));
  }, [mode]);

  useEffect(() => {
    // setState here is a legitimate sync from DOM measurement (read-only external system).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  return width;
}

interface CardGridProps {
  items: TasteItem[];
  loading?: boolean;
  totalCount?: number;
  layoutMode?: LayoutMode;
  onDelete: (id: string) => void;
  onZoom: (item: TasteItem) => void;
  onClearFilters?: () => void;
  onUpdateCategory?: (id: string, category: import("../lib/types").Category) => void;
}

export function CardGrid({
  items,
  loading,
  totalCount = 0,
  layoutMode = "masonry",
  onDelete,
  onZoom,
  onClearFilters,
  onUpdateCategory,
}: CardGridProps) {
  const columnWidth = useColumnWidth(layoutMode);
  const { register, getSpan } = useImageDimensions(columnWidth, ROW_HEIGHT, GAP_Y);

  if (loading) {
    const count =
      layoutMode === "grid"
        ? SKELETON_COUNT_GRID
        : layoutMode === "feed"
          ? SKELETON_COUNT_FEED
          : SKELETON_HEIGHTS.length;

    return (
      <div className="card-layout" data-mode={layoutMode}>
        {Array.from({ length: count }, (_, i) => (
          <SkeletonCard
            key={i}
            height={SKELETON_HEIGHTS[i % SKELETON_HEIGHTS.length]}
            mode={layoutMode}
          />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    if (totalCount === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-32">
          <svg
            width="48"
            height="48"
            viewBox="0 0 48 48"
            fill="none"
            style={{ color: "var(--color-text-tertiary)", opacity: 0.5 }}
          >
            <rect x="6" y="10" width="36" height="28" rx="4" stroke="currentColor" strokeWidth="1.5" />
            <path d="M6 30l10-8 8 6 8-10 10 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="16" cy="20" r="3" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <p
            className="mt-4 text-[15px]"
            style={{ color: "var(--color-text-tertiary)", textWrap: "pretty" }}
          >
            {"Drop an\u00A0image or paste a\u00A0URL to\u00A0start"}
          </p>
          <p
            className="mt-2 text-[12px]"
            style={{ color: "var(--color-text-tertiary)", opacity: 0.6 }}
          >
            {"Drag & drop \u00B7 Click\u00A0+ to\u00A0add"}
          </p>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-32">
        <p
          className="text-[15px]"
          style={{ color: "var(--color-text-tertiary)", textWrap: "pretty" }}
        >
          {"No items in\u00A0these\u00A0categories"}
        </p>
        {onClearFilters && (
          <button
            onClick={onClearFilters}
            className="mt-3 rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors duration-150"
            style={{
              background: "var(--color-surface-2)",
              color: "var(--color-text-secondary)",
            }}
          >
            Clear filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="card-layout" data-mode={layoutMode}>
      <AnimatePresence mode="popLayout">
        {items.map((item, i) => (
          <TasteCard
            key={item.id}
            item={item}
            index={i}
            layoutMode={layoutMode}
            onDelete={onDelete}
            onZoom={onZoom}
            onUpdateCategory={onUpdateCategory}
            masonrySpan={layoutMode === "masonry" ? getSpan(item.id) : undefined}
            onMeasure={layoutMode === "masonry" ? register : undefined}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
