import { useMemo, useState, useEffect, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { TasteCard } from "./TasteCard";
import type { TasteItem } from "../lib/types";

const SKELETON_HEIGHTS = [180, 240, 160, 220, 200, 260, 150, 210];
const GAP = 16;

function useColumnCount() {
  const [cols, setCols] = useState(() => {
    if (typeof window === "undefined") return 4;
    const w = window.innerWidth;
    if (w <= 560) return 1;
    if (w <= 900) return 2;
    if (w <= 1280) return 3;
    return 4;
  });

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      setCols(w <= 560 ? 1 : w <= 900 ? 2 : w <= 1280 ? 3 : 4);
    };
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return cols;
}

/** Distribute items round-robin into columns (Pinterest-style chronological). */
function distributeItems(items: TasteItem[], colCount: number): TasteItem[][] {
  const columns: TasteItem[][] = Array.from({ length: colCount }, () => []);
  for (let i = 0; i < items.length; i++) {
    columns[i % colCount].push(items[i]);
  }
  return columns;
}

interface CardGridProps {
  items: TasteItem[];
  loading?: boolean;
  totalCount?: number;
  onDelete: (id: string) => void;
  onZoom: (item: TasteItem) => void;
  onClearFilters?: () => void;
}

export function CardGrid({ items, loading, totalCount = 0, onDelete, onZoom, onClearFilters }: CardGridProps) {
  const colCount = useColumnCount();

  const columns = useMemo(
    () => distributeItems(items, colCount),
    [items, colCount]
  );

  const getIndex = useCallback(
    (colIdx: number, rowIdx: number) => rowIdx * colCount + colIdx,
    [colCount]
  );

  if (loading) {
    return (
      <div className="masonry">
        {SKELETON_HEIGHTS.map((h, i) => (
          <div
            key={i}
            className="skeleton-shimmer rounded-xl"
            style={{ height: h }}
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
    <div className="flex" style={{ gap: GAP }}>
      {columns.map((colItems, colIdx) => (
        <div key={colIdx} className="flex flex-1 flex-col" style={{ gap: GAP }}>
          <AnimatePresence mode="popLayout">
            {colItems.map((item, rowIdx) => (
              <TasteCard
                key={item.id}
                item={item}
                index={getIndex(colIdx, rowIdx)}
                onDelete={onDelete}
                onZoom={onZoom}
              />
            ))}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}
