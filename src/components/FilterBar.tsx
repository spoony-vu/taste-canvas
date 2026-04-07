import { motion } from "framer-motion";
import { categories } from "../lib/categories";
import type { Category } from "../lib/types";

interface FilterBarProps {
  active: Set<Category>;
  onToggle: (cat: Category) => void;
  onClear: () => void;
}

export function FilterBar({ active, onToggle, onClear }: FilterBarProps) {
  const allActive = active.size === 0;

  return (
    <div className="flex flex-wrap gap-2">
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
      {categories.map((cat) => {
        const isActive = active.has(cat.id);
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
          </motion.button>
        );
      })}
    </div>
  );
}
