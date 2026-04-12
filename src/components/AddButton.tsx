import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface AddButtonProps {
  onAddUrl: () => void;
  onAddImage: () => void;
  onAddTwitter?: () => void;
}

export function AddButton({ onAddUrl, onAddImage, onAddTwitter }: AddButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
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

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-medium transition-colors duration-150"
        style={{
          background: "var(--color-text-primary)",
          color: "var(--color-surface-0)",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path
            d="M8 3v10M3 8h10"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        Add
        <svg
          width="10"
          height="10"
          viewBox="0 0 16 16"
          fill="none"
          className="ml-0.5 transition-transform duration-150"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0)" }}
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
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-full z-30 mt-1.5 min-w-[140px] overflow-hidden rounded-xl py-1"
            style={{
              background: "var(--color-surface-1)",
              boxShadow:
                "0 8px 24px oklch(0 0 0 / 0.35), 0 0 0 0.5px var(--color-border)",
            }}
          >
            <button
              onClick={() => { onAddUrl(); close(); }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-medium transition-colors duration-100"
              style={{ color: "var(--color-text-primary)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--color-surface-2)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
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
            <button
              onClick={() => { onAddImage(); close(); }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-medium transition-colors duration-100"
              style={{ color: "var(--color-text-primary)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--color-surface-2)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ color: "var(--color-text-tertiary)" }}>
                <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" />
                <circle cx="5.5" cy="5.5" r="1" fill="currentColor" />
                <path d="M2 11l3-3 2 2 3-3 4 4v1a1 1 0 01-1 1H3a1 1 0 01-1-1v-1z" fill="currentColor" opacity="0.4" />
              </svg>
              Image
            </button>
            {onAddTwitter && (
              <button
                onClick={() => { onAddTwitter(); close(); }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-medium transition-colors duration-100"
                style={{ color: "var(--color-text-primary)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--color-surface-2)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ color: "var(--color-text-tertiary)" }}>
                  <path
                    d="M9.3 6.7L14 1.5M2 14.5l5.3-5.8M2 1.5h3.5l9 13H11z"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Twitter
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
