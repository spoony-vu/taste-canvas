import { useState, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { categoryMap } from "../lib/categories";
import { thumbUrl } from "../lib/image";
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
  const [loaded, setLoaded] = useState(false);
  const handleLoad = useCallback(() => setLoaded(true), []);
  const reduced = useReducedMotion();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: reduced ? 0 : 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: reduced ? 0 : 0.25, delay: reduced ? 0 : index * 0.03 }}
      className="group relative overflow-hidden rounded-xl"
    >
      <button
        onClick={() => onZoom(item)}
        className="block w-full cursor-zoom-in text-left"
      >
        <div
          className="relative overflow-hidden"
          style={item.lqip ? {
            backgroundImage: `url(${item.lqip})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          } : undefined}
        >
          <img
            src={thumbUrl(item.thumb, item.image)}
            alt={item.title}
            loading="lazy"
            onLoad={handleLoad}
            className="block w-full transition-[transform,opacity] duration-250 ease-out group-hover:scale-[1.02]"
            style={{ opacity: loaded ? 1 : 0 }}
          />
          <div
            className="absolute inset-0 flex flex-col justify-end p-3 pt-16 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            style={{
              background:
                "linear-gradient(to top, oklch(0.1 0.01 260 / 0.85), transparent)",
            }}
          >
            <div className="flex items-end justify-between gap-2">
              <div className="flex flex-col gap-1.5">
                <span
                  className="inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
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
                <p className="text-[13px] font-medium leading-tight text-white">
                  {item.title}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {hasUrl && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded p-1 opacity-60 transition-opacity duration-150 hover:opacity-100"
                    style={{ color: "var(--color-text-primary)" }}
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
                  className="rounded p-1 opacity-60 transition-opacity duration-150 hover:opacity-100"
                  style={{ color: "var(--color-text-primary)" }}
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
          </div>
        </div>
      </button>
    </motion.div>
  );
}
