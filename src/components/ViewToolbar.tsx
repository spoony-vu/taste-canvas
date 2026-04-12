import { motion } from "framer-motion";
import type { LayoutMode } from "../lib/types";

interface ViewToolbarProps {
  layoutMode: LayoutMode;
  onLayoutChange: (mode: LayoutMode) => void;
  showArchived: boolean;
  onToggleArchived: () => void;
  archivedCount: number;
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
  showArchived,
  onToggleArchived,
  archivedCount,
}: ViewToolbarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
      className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full px-1.5 py-1.5"
      style={{
        background: "oklch(0.15 0.01 260 / 0.85)",
        backdropFilter: "blur(16px)",
        boxShadow: "0 8px 32px oklch(0 0 0 / 0.4), 0 0 0 0.5px oklch(0.3 0.01 260 / 0.5)",
      }}
    >
      {layouts.map(({ mode, label, icon }) => (
        <button
          key={mode}
          onClick={() => onLayoutChange(mode)}
          className="relative flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-150"
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

      {archivedCount > 0 && (
        <>
          <div
            className="mx-0.5 h-4 w-px"
            style={{ background: "var(--color-border)" }}
          />
          <button
            onClick={onToggleArchived}
            className="flex h-8 items-center gap-1.5 rounded-full px-2.5 transition-colors duration-150"
            style={{
              color: showArchived
                ? "var(--color-text-primary)"
                : "var(--color-text-tertiary)",
              background: showArchived ? "var(--color-surface-3)" : "transparent",
            }}
            title={showArchived ? "Hide archived" : "Show archived"}
            aria-label={showArchived ? "Hide archived items" : "Show archived items"}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 4h12M3 4v8.5a1.5 1.5 0 001.5 1.5h7a1.5 1.5 0 001.5-1.5V4M6 8h4"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span
              className="text-[11px] font-medium"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {archivedCount}
            </span>
          </button>
        </>
      )}
    </motion.div>
  );
}
