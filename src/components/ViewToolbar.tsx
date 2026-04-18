import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { LayoutMode } from "../lib/types";

interface ViewToolbarProps {
  layoutMode: LayoutMode;
  onLayoutChange: (mode: LayoutMode) => void;
  onAddUrl?: () => void;
  onAddImage?: () => void;
}

const layouts: { mode: LayoutMode; label: string; icon: React.ReactNode }[] = [
  {
    mode: "masonry",
    label: "Masonry",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="6" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <rect x="9" y="1" width="6" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <rect x="1" y="11" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <rect x="9" y="8" width="6" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    mode: "grid",
    label: "Grid",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    mode: "feed",
    label: "Feed",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="3" y="1" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <rect x="3" y="9" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
];

export function ViewToolbar({
  layoutMode,
  onLayoutChange,
  onAddUrl,
  onAddImage,
}: ViewToolbarProps) {
  const [addOpen, setAddOpen] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);

  const closeAdd = useCallback(() => setAddOpen(false), []);

  useEffect(() => {
    if (!addOpen) return;
    function handleClick(e: MouseEvent) {
      if (addRef.current && !addRef.current.contains(e.target as Node)) closeAdd();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeAdd();
    }
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [addOpen, closeAdd]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
      className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full px-1.5 py-1.5"
      style={{
        background: "var(--color-floating-bg)",
        backdropFilter: "blur(16px)",
        boxShadow: "0 8px 32px oklch(0 0 0 / 0.25), 0 0 0 0.5px var(--color-floating-ring)",
      }}
    >
      {layouts.map(({ mode, label, icon }) => (
        <button
          key={mode}
          onClick={() => onLayoutChange(mode)}
          className={`relative flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-150${mode === "masonry" ? " hidden sm:flex" : ""}`}
          style={{
            color: layoutMode === mode
              ? "var(--color-text-primary)"
              : "var(--color-text-tertiary)",
          }}
          title={label}
          aria-label={`${label} layout`}
        >
          {layoutMode === mode && (
            <motion.div
              layoutId="toolbar-active"
              className="absolute inset-0 rounded-full"
              style={{ background: "var(--color-surface-3)" }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            />
          )}
          <span className="relative">{icon}</span>
        </button>
      ))}

      {/* Mobile add button */}
      {(onAddUrl || onAddImage) && (
        <>
          <div
            className="mx-0.5 h-4 w-px sm:hidden"
            style={{ background: "var(--color-border)" }}
          />
          <div ref={addRef} className="relative sm:hidden">
            <button
              onClick={() => setAddOpen((p) => !p)}
              className="flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-150"
              style={{
                background: "var(--color-text-primary)",
                color: "var(--color-surface-0)",
              }}
              aria-label="Add item"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                className="transition-transform duration-150"
                style={{ transform: addOpen ? "rotate(45deg)" : "rotate(0)" }}
              >
                <path
                  d="M8 3v10M3 8h10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>

            <AnimatePresence>
              {addOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.97 }}
                  transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute bottom-full right-0 mb-2 min-w-[140px] overflow-hidden rounded-xl py-1"
                  style={{
                    background: "var(--color-surface-1)",
                    boxShadow:
                      "0 8px 24px oklch(0 0 0 / 0.35), 0 0 0 0.5px var(--color-border)",
                  }}
                >
                  {onAddUrl && (
                    <button
                      onClick={() => { onAddUrl(); closeAdd(); }}
                      className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-medium"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ color: "var(--color-text-tertiary)" }}>
                        <path
                          d="M6.5 10.5l-1 1a2.12 2.12 0 01-3-3l2-2a2.12 2.12 0 013 0M9.5 5.5l1-1a2.12 2.12 0 013 3l-2 2a2.12 2.12 0 01-3 0"
                          stroke="currentColor"
                          strokeWidth="1.3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      URL
                    </button>
                  )}
                  {onAddImage && (
                    <button
                      onClick={() => { onAddImage(); closeAdd(); }}
                      className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-medium"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ color: "var(--color-text-tertiary)" }}>
                        <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" />
                        <circle cx="5.5" cy="5.5" r="1" fill="currentColor" />
                        <path d="M2 11l3-3 2 2 3-3 4 4v1a1 1 0 01-1 1H3a1 1 0 01-1-1v-1z" fill="currentColor" opacity="0.4" />
                      </svg>
                      Image
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      )}
    </motion.div>
  );
}
