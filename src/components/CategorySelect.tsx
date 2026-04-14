import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { categories, categoryMap } from "../lib/categories";
import type { Category } from "../lib/types";

interface CategorySelectProps {
  value: Category;
  onChange: (value: Category) => void;
  size?: "default" | "compact";
}

export function CategorySelect({ value, onChange, size = "default" }: CategorySelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selected = categoryMap[value];

  const h = size === "compact" ? "h-9" : "h-10";
  const text = size === "compact" ? "text-[13px]" : "text-[14px]";

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open, close]);

  // Scroll active item into view when opening
  useEffect(() => {
    if (open && listRef.current) {
      const active = listRef.current.querySelector("[data-active]");
      active?.scrollIntoView({ block: "nearest" });
    }
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex ${h} w-full items-center gap-2.5 rounded-lg border-none px-3 ${text} outline-none transition-[box-shadow] duration-100`}
        style={{
          background: "var(--color-surface-0)",
          color: "var(--color-text-primary)",
          boxShadow: open
            ? "0 0 0 1.5px oklch(0.55 0.1 260)"
            : "0 0 0 0px transparent",
        }}
      >
        <span
          className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
          style={{ background: selected.dot }}
        />
        <span className="flex-1 text-left">{selected.label}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          className="flex-shrink-0 transition-transform duration-150"
          style={{
            color: "var(--color-text-tertiary)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={listRef}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-xl py-1"
            style={{
              background: "var(--color-surface-2)",
              boxShadow:
                "0 12px 32px oklch(0 0 0 / 0.5), 0 0 0 0.5px var(--color-border)",
            }}
          >
            <div className="max-h-[280px] overflow-y-auto scrollbar-none">
              {categories.map((cat) => {
                const active = cat.id === value;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    {...(active ? { "data-active": true } : {})}
                    onClick={() => {
                      onChange(cat.id);
                      close();
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] transition-colors duration-75"
                    style={{
                      color: active
                        ? "var(--color-text-primary)"
                        : "var(--color-text-secondary)",
                      background: active
                        ? "oklch(1 0 0 / 0.06)"
                        : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (!active) e.currentTarget.style.background = "oklch(1 0 0 / 0.04)";
                    }}
                    onMouseLeave={(e) => {
                      if (!active) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <span
                      className="h-2 w-2 flex-shrink-0 rounded-full"
                      style={{ background: cat.dot }}
                    />
                    <span className="flex-1 text-left">{cat.label}</span>
                    {active && (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 16 16"
                        fill="none"
                        style={{ color: "var(--color-text-primary)" }}
                      >
                        <path
                          d="M3 8l4 4 6-8"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
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
