import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { categories, categoryMap } from "../lib/categories";
import type { Category } from "../lib/types";

interface CategoryBadgeProps {
  category: Category;
  onUpdate?: (category: Category) => void;
}

export function CategoryBadge({ category, onUpdate }: CategoryBadgeProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const cat = categoryMap[category];

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    }
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey, true);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey, true);
    };
  }, [open, close]);

  const interactive = !!onUpdate;

  return (
    <div ref={containerRef} className="relative">
      <span
        role={interactive ? "button" : undefined}
        onClick={interactive ? (e) => { e.stopPropagation(); setOpen((o) => !o); } : undefined}
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium ${interactive ? "cursor-pointer transition-[box-shadow] duration-100" : ""}`}
        style={{
          background: `color-mix(in oklch, ${cat.dot}, transparent 85%)`,
          color: cat.color,
          boxShadow: open ? `0 0 0 1.5px ${cat.dot}` : "none",
        }}
      >
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: cat.dot }}
        />
        {cat.label}
        {interactive && (
          <svg
            width="10"
            height="10"
            viewBox="0 0 16 16"
            fill="none"
            className="ml-0.5 transition-transform duration-150"
            style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>

      <AnimatePresence>
        {open && onUpdate && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-xl py-1"
            style={{
              background: "var(--color-surface-2)",
              boxShadow: "0 12px 32px oklch(0 0 0 / 0.5), 0 0 0 0.5px var(--color-border)",
              minWidth: 160,
            }}
          >
            <div className="max-h-[280px] overflow-y-auto scrollbar-none">
              {categories.map((c) => {
                const active = c.id === category;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdate(c.id);
                      close();
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-1.5 text-[12px] transition-colors duration-75"
                    style={{
                      color: active ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                      background: active ? "oklch(1 0 0 / 0.06)" : "transparent",
                    }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "oklch(1 0 0 / 0.04)"; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
                  >
                    <span
                      className="h-2 w-2 flex-shrink-0 rounded-full"
                      style={{ background: c.dot }}
                    />
                    <span className="flex-1 text-left">{c.label}</span>
                    {active && (
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ color: "var(--color-text-primary)" }}>
                        <path d="M3 8l4 4 6-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
