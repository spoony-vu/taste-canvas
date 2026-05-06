import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  addCustomCategory,
  removeCustomCategory,
  useCategories,
} from "../lib/categories";
import type { Category, TasteItem } from "../lib/types";

interface FilterBarProps {
  active: Set<Category>;
  items: TasteItem[];
  filteredCount: number;
  onToggle: (cat: Category) => void;
  onClear: () => void;
}

// Built-in slugs — used to decide which 0-count categories to hide.
// Custom categories are always shown so the user can find/use what they
// just created, even before assigning items.
const BUILT_IN_IDS = new Set([
  "typeface",
  "symbol",
  "landing-pages",
  "interactions",
  "patterns",
  "branding",
  "ui",
  "graphics",
  "tools",
]);

export function FilterBar({ active, items, filteredCount, onToggle, onClear }: FilterBarProps) {
  const allActive = active.size === 0;
  const categories = useCategories();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Which custom category is currently in "Delete?" confirmation mode.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // Click outside / Esc dismisses the in-flight confirmation so a pill
  // doesn't get stuck mid-delete.
  useEffect(() => {
    if (!confirmingId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setConfirmingId(null);
    }
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest(`[data-confirm-id="${confirmingId}"]`)) {
        setConfirmingId(null);
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [confirmingId]);

  const counts = useMemo(() => {
    const map: Partial<Record<Category, number>> = {};
    for (const item of items) {
      map[item.category] = (map[item.category] ?? 0) + 1;
    }
    return map;
  }, [items]);

  const visibleCategories = categories.filter((cat) => {
    const count = counts[cat.id] ?? 0;
    if (count > 0) return true;
    return !BUILT_IN_IDS.has(cat.id); // custom always show
  });

  function startAdd() {
    setAdding(true);
    setDraft("");
    setError(null);
    queueMicrotask(() => inputRef.current?.focus());
  }

  function cancelAdd() {
    setAdding(false);
    setDraft("");
    setError(null);
  }

  function commitAdd() {
    const def = addCustomCategory(draft);
    if (!def) {
      setError("Pick a unique name");
      return;
    }
    setAdding(false);
    setDraft("");
    setError(null);
  }

  return (
    <div className="scrollbar-none flex items-center gap-2 overflow-x-auto sm:flex-wrap sm:overflow-x-visible">
      <button
        onClick={onClear}
        className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors duration-150"
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
        const isCustom = !BUILT_IN_IDS.has(cat.id);
        const isConfirming = confirmingId === cat.id;

        // Confirmation morph — pill swaps to "Delete? ✓ ✗" inline.
        if (isCustom && isConfirming) {
          return (
            <motion.div
              key={cat.id}
              data-confirm-id={cat.id}
              layout
              initial={{ opacity: 0.6 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.12 }}
              className="flex shrink-0 items-center gap-1 rounded-full pl-3 pr-1 py-1 text-[13px] font-medium"
              style={{
                background: "var(--color-surface-1)",
                color: "var(--color-text-primary)",
                boxShadow: "0 0 0 1.5px oklch(0.65 0.18 25)",
              }}
            >
              <span style={{ color: "var(--color-text-secondary)" }}>
                Delete{" "}
                <span style={{ color: "var(--color-text-primary)" }}>
                  {cat.label}
                </span>
                ?
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeCustomCategory(cat.id);
                  setConfirmingId(null);
                }}
                aria-label={`Confirm delete ${cat.label}`}
                className="ml-1 flex h-6 w-6 items-center justify-center rounded-full transition-colors duration-100"
                style={{ color: "oklch(0.65 0.18 25)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "oklch(0.65 0.18 25 / 0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M3 8l4 4 6-8"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmingId(null);
                }}
                aria-label="Cancel"
                className="flex h-6 w-6 items-center justify-center rounded-full transition-colors duration-100"
                style={{ color: "var(--color-text-tertiary)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--color-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M3 3l10 10M13 3L3 13"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </motion.div>
          );
        }

        return (
          <motion.div
            key={cat.id}
            layout
            className="group/pill relative shrink-0"
          >
            <motion.button
              onClick={() => onToggle(cat.id)}
              whileTap={{ scale: 0.96 }}
              className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors duration-150"
              style={{
                background: isActive
                  ? "var(--color-surface-3)"
                  : "var(--color-surface-1)",
                color: isActive
                  ? "var(--color-text-primary)"
                  : "var(--color-text-tertiary)",
                paddingRight: isCustom ? 26 : undefined,
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
            {isCustom && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmingId(cat.id);
                }}
                aria-label={`Delete ${cat.label}`}
                title={`Delete ${cat.label}`}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full opacity-0 transition-opacity duration-100 group-hover/pill:opacity-100 focus-visible:opacity-100"
                style={{
                  color: "var(--color-text-tertiary)",
                  background: "transparent",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--color-hover)";
                  e.currentTarget.style.color = "var(--color-text-primary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--color-text-tertiary)";
                }}
              >
                <svg width="9" height="9" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M3 3l10 10M13 3L3 13"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            )}
          </motion.div>
        );
      })}

      <AnimatePresence mode="wait" initial={false}>
        {adding ? (
          <motion.div
            key="input"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1"
            style={{
              background: "var(--color-surface-1)",
              boxShadow: error
                ? "0 0 0 1.5px oklch(0.65 0.18 25)"
                : "0 0 0 1.5px oklch(0.55 0.1 260)",
            }}
          >
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitAdd();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancelAdd();
                }
              }}
              onBlur={() => {
                // Defer so a click on the check/cancel button registers first.
                setTimeout(() => {
                  if (!draft.trim()) cancelAdd();
                }, 120);
              }}
              placeholder="New category"
              className="w-32 bg-transparent text-[13px] outline-none"
              style={{ color: "var(--color-text-primary)" }}
              maxLength={32}
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
            />
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={commitAdd}
              aria-label="Add category"
              className="flex h-6 w-6 items-center justify-center rounded-full transition-colors duration-100"
              style={{ color: "var(--color-text-secondary)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--color-hover)";
                e.currentTarget.style.color = "var(--color-text-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--color-text-secondary)";
              }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M3 8l4 4 6-8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={cancelAdd}
              aria-label="Cancel"
              className="flex h-6 w-6 items-center justify-center rounded-full transition-colors duration-100"
              style={{ color: "var(--color-text-tertiary)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--color-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </motion.div>
        ) : (
          <motion.button
            key="add"
            type="button"
            onClick={startAdd}
            whileTap={{ scale: 0.96 }}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            aria-label="Add category"
            title="Add category"
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full transition-colors duration-150"
            style={{
              background: "var(--color-surface-1)",
              color: "var(--color-text-tertiary)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--color-surface-3)";
              e.currentTarget.style.color = "var(--color-text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--color-surface-1)";
              e.currentTarget.style.color = "var(--color-text-tertiary)";
            }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>

      <span
        className="ml-auto shrink-0 text-[12px]"
        style={{ color: "var(--color-text-tertiary)", fontVariantNumeric: "tabular-nums" }}
      >
        {filteredCount} item{filteredCount !== 1 ? "s" : ""}
      </span>
    </div>
  );
}
