import { useMemo } from "react";
import { motion } from "framer-motion";
import { categories } from "../lib/categories";
import type { Category, TasteItem } from "../lib/types";

interface FilterBarProps {
  active: Set<Category>;
  items: TasteItem[];
  filteredCount: number;
  onToggle: (cat: Category) => void;
  onClear: () => void;
}

export function FilterBar({ active, items, filteredCount, onToggle, onClear }: FilterBarProps) {
  const allActive = active.size === 0;

  const counts = useMemo(() => {
    const map: Partial<Record<Category, number>> = {};
    for (const item of items) {
      map[item.category] = (map[item.category] ?? 0) + 1;
    }
    return map;
  }, [items]);

  const visibleCategories = categories.filter((cat) => (counts[cat.id] ?? 0) > 0);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={onClear}
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors duration-150"
        style={{
          background: allActive
            ? "var(--color-surface-3)"
            : "var(--color-surface-1)",
          color: allActive
            ? "var(--color-text-primary)"
            : "var(--color-text-tertiary)",
        }}
      >
        All
      </button>
      {visibleCategories.map((cat) => {
        const isActive = active.has(cat.id);
        const count = counts[cat.id] ?? 0;
        return (
          <motion.button
            key={cat.id}
            onClick={() => onToggle(cat.id)}
            whileTap={{ scale: 0.96 }}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors duration-150"
            style={{
              background: isActive
                ? "var(--color-surface-3)"
                : "var(--color-surface-1)",
              color: isActive
                ? "var(--color-text-primary)"
                : "var(--color-text-tertiary)",
            }}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{
                background: cat.dot,
                opacity: isActive || allActive ? 1 : 0.4,
              }}
            />
            {cat.label}
            <span
              className="text-[11px] opacity-50"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {count}
            </span>
          </motion.button>
        );
      })}
      <span
        className="ml-auto text-[12px]"
        style={{ color: "var(--color-text-tertiary)", fontVariantNumeric: "tabular-nums" }}
      >
        {filteredCount} item{filteredCount !== 1 ? "s" : ""}
      </span>
    </div>
  );
}
