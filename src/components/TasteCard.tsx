import { motion } from "framer-motion";
import { categoryMap } from "../lib/categories";
import { imageUrl } from "../lib/image";
import type { TasteItem } from "../lib/types";

interface TasteCardProps {
  item: TasteItem;
  index: number;
  onDelete: (id: string) => void;
  onZoom: (item: TasteItem) => void;
}

export function TasteCard({ item, index, onDelete, onZoom }: TasteCardProps) {
  const cat = categoryMap[item.category];
  const hasUrl = item.url && item.url.length > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.25, delay: index * 0.03 }}
      className="group relative overflow-hidden rounded-xl"
      style={{ background: "var(--color-surface-1)" }}
    >
      <button
        onClick={() => onZoom(item)}
        className="block w-full cursor-zoom-in text-left"
      >
        <div className="relative overflow-hidden">
          <img
            src={imageUrl(item.image)}
            alt={item.title}
            loading="lazy"
            className="block w-full transition-transform duration-250 ease-out group-hover:scale-[1.02]"
          />
          <div
            className="absolute inset-x-0 bottom-0 flex items-end p-3 pt-12"
            style={{
              background:
                "linear-gradient(to top, oklch(0.1 0.01 260 / 0.85), transparent)",
            }}
          >
            <p className="flex-1 text-[13px] font-medium leading-tight text-white">
              {item.title}
            </p>
          </div>
        </div>
      </button>
      <div className="flex items-center justify-between px-3 py-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{
            background: `color-mix(in oklch, ${cat.dot}, transparent 85%)`,
            color: cat.color,
          }}
        >
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: cat.dot }}
          />
          {cat.label}
        </span>
        <div className="flex items-center gap-1">
          {hasUrl && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded p-1 opacity-0 transition-opacity duration-150 group-hover:opacity-60 hover:!opacity-100"
              style={{ color: "var(--color-text-tertiary)" }}
              title="Visit site"
              onClick={(e) => e.stopPropagation()}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path
                  d="M6 3h7v7M13 3L5 11"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item.id);
            }}
            className="rounded p-1 opacity-0 transition-opacity duration-150 group-hover:opacity-60 hover:!opacity-100"
            style={{ color: "var(--color-text-tertiary)" }}
            title="Remove"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
