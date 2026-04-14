import { memo, useState, useCallback, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { thumbUrl } from "../lib/image";
import { CategoryBadge } from "./CategoryBadge";
import type { Category, LayoutMode, TasteItem } from "../lib/types";

interface TasteCardProps {
  item: TasteItem;
  index: number;
  layoutMode?: LayoutMode;
  masonrySpan?: number;
  onMeasure?: (id: string, el: HTMLImageElement | HTMLVideoElement) => void;
  onDelete: (id: string) => void;
  onZoom: (item: TasteItem) => void;
  onUpdateCategory?: (id: string, category: Category) => void;
}

const layoutTransition = {
  layout: { type: "spring" as const, stiffness: 300, damping: 30, mass: 0.8 },
};

export const TasteCard = memo(function TasteCard({
  item,
  index,
  layoutMode = "masonry",
  masonrySpan,
  onMeasure,
  onDelete,
  onZoom,
  onUpdateCategory,
}: TasteCardProps) {
  const hasUrl = item.url && item.url.length > 0;
  const isVideo = !!item.video;
  const [loaded, setLoaded] = useState(false);
  const reduced = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement | HTMLVideoElement>) => {
      setLoaded(true);
      onMeasure?.(item.id, e.currentTarget);
    },
    [item.id, onMeasure]
  );

  // Videos: layoutId goes on the poster thumbnail (not the <video> element, which FLIP distorts).
  // Always keep layoutId so both enter AND exit shared layout morph works.
  // The lightbox backdrop (z-50) covers the card poster during view — no duplication visible.
  const imageLayoutId = `image-${item.id}`;

  // Masonry mode: items need grid-row span for variable heights
  const masonryStyle =
    layoutMode === "masonry" && masonrySpan
      ? { gridRow: `span ${masonrySpan}` }
      : undefined;

  if (layoutMode === "grid") {
    return (
      <motion.div
        layout
        layoutId={item.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: reduced ? 0 : 0.2, ...layoutTransition }}
        className="group relative overflow-hidden rounded-lg"
        style={{
          aspectRatio: "3/2",
          willChange: "transform",
          backfaceVisibility: "hidden",
        }}
      >
        <button
          onClick={() => onZoom(item)}
          className="block h-full w-full cursor-zoom-in"
        >
          {isVideo ? (
            <>
              <motion.img
                layoutId={imageLayoutId}
                src={thumbUrl(item.thumb, item.image)}
                alt={item.title}
                onLoad={(e) => onMeasure?.(item.id, e.currentTarget)}
                className="h-full w-full object-cover"
                transition={layoutTransition}
              />
              <video
                ref={videoRef}
                src={item.video}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                onLoadedData={() => setLoaded(true)}
                className="absolute inset-0 h-full w-full object-cover"
                style={{ opacity: loaded ? 1 : 0, transition: "opacity 0.3s ease" }}
              />
            </>
          ) : (
            <motion.img
              layoutId={imageLayoutId}
              src={thumbUrl(item.thumb, item.image)}
              alt={item.title}
              loading="lazy"
              onLoad={handleLoad}
              className="h-full w-full object-cover"
              style={{ opacity: loaded ? 1 : 0 }}
              transition={layoutTransition}
            />
          )}
          {isVideo && (
            <div
              className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full transition-opacity duration-150 group-hover:opacity-0"
              style={{ background: "oklch(0.1 0.01 260 / 0.7)" }}
            >
              <svg width="10" height="10" viewBox="0 0 16 16" fill="white">
                <path d="M4 2l10 6-10 6V2z" />
              </svg>
            </div>
          )}
          <div
            className="absolute inset-0 flex items-end p-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            style={{
              background: "linear-gradient(to top, oklch(0.1 0.01 260 / 0.8), transparent 60%)",
            }}
          >
            <p className="truncate text-[11px] font-medium text-white">
              {item.title}
            </p>
          </div>
        </button>
      </motion.div>
    );
  }

  if (layoutMode === "feed") {
    return (
      <motion.div
        layout
        layoutId={item.id}
        initial={{ opacity: 0, y: reduced ? 0 : 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: reduced ? 0 : 0.25, delay: reduced ? 0 : Math.min(index * 0.03, 0.3), ...layoutTransition }}
        className="group overflow-hidden rounded-xl"
        style={{
          willChange: "transform",
          backfaceVisibility: "hidden",
        }}
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
            {isVideo ? (
              <>
                <motion.img
                  layoutId={imageLayoutId}
                  src={thumbUrl(item.thumb, item.image)}
                  alt={item.title}
                  onLoad={(e) => onMeasure?.(item.id, e.currentTarget)}
                  className="block w-full"
                  transition={layoutTransition}
                />
                <video
                  ref={videoRef}
                  src={item.video}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  onLoadedData={() => setLoaded(true)}
                  className="absolute inset-0 h-full w-full object-cover"
                  style={{ opacity: loaded ? 1 : 0, transition: "opacity 0.3s ease" }}
                />
              </>
            ) : (
              <motion.img
                layoutId={imageLayoutId}
                src={thumbUrl(item.thumb, item.image)}
                alt={item.title}
                loading="lazy"
                onLoad={handleLoad}
                className="block w-full"
                style={{ opacity: loaded ? 1 : 0 }}
                transition={layoutTransition}
              />
            )}
            {isVideo && (
              <div
                className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full transition-opacity duration-150 group-hover:opacity-0"
                style={{ background: "oklch(0.1 0.01 260 / 0.7)" }}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="white">
                  <path d="M4 2l10 6-10 6V2z" />
                </svg>
              </div>
            )}
          </div>
        </button>
        <div className="flex items-center justify-between gap-2 px-1 pt-2.5">
          <div className="flex items-center gap-2 overflow-hidden">
            <CategoryBadge
              category={item.category}
              onUpdate={onUpdateCategory ? (c) => onUpdateCategory(item.id, c) : undefined}
            />
            <p className="truncate text-[13px] font-medium" style={{ color: "var(--color-text-primary)" }}>
              {item.title}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {hasUrl && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded p-1 transition-opacity duration-150"
                style={{ color: "var(--color-text-tertiary)" }}
                title="Visit site"
                onClick={(e) => e.stopPropagation()}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M6 3h7v7M13 3L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
              className="rounded p-1 transition-opacity duration-150"
              style={{ color: "var(--color-text-tertiary)" }}
              title="Remove"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // Default: masonry
  return (
    <motion.div
      layout
      layoutId={item.id}
      initial={{ opacity: 0, y: reduced ? 0 : 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: reduced ? 0 : 0.25, delay: reduced ? 0 : Math.min(index * 0.03, 0.3), ...layoutTransition }}
      className="group relative overflow-hidden"
      style={{
        willChange: "transform",
        backfaceVisibility: "hidden",
        paddingBottom: 16,
        ...masonryStyle,
      }}
    >
      <button
        onClick={() => onZoom(item)}
        className="block h-full w-full cursor-zoom-in text-left"
      >
        <div
          className="relative h-full overflow-hidden rounded-xl"
          style={item.lqip ? {
            backgroundImage: `url(${item.lqip})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          } : undefined}
        >
          {isVideo ? (
            <>
              <motion.img
                layoutId={imageLayoutId}
                src={thumbUrl(item.thumb, item.image)}
                alt={item.title}
                onLoad={(e) => onMeasure?.(item.id, e.currentTarget)}
                className="block h-full w-full object-cover"
                transition={layoutTransition}
              />
              <video
                ref={videoRef}
                src={item.video}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                onLoadedData={() => setLoaded(true)}
                className="absolute inset-0 h-full w-full object-cover"
                style={{ opacity: loaded ? 1 : 0, transition: "opacity 0.3s ease" }}
              />
            </>
          ) : (
            <motion.img
              layoutId={imageLayoutId}
              src={thumbUrl(item.thumb, item.image)}
              alt={item.title}
              loading="lazy"
              onLoad={handleLoad}
              className="block h-full w-full object-cover"
              style={{ opacity: loaded ? 1 : 0 }}
              transition={layoutTransition}
            />
          )}
          {isVideo && (
            <div
              className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full transition-opacity duration-150 group-hover:opacity-0"
              style={{ background: "oklch(0.1 0.01 260 / 0.7)" }}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="white">
                <path d="M4 2l10 6-10 6V2z" />
              </svg>
            </div>
          )}
          <div
            className="absolute inset-0 flex flex-col justify-end p-3 pt-16 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            style={{
              background:
                "linear-gradient(to top, oklch(0.1 0.01 260 / 0.85), transparent)",
            }}
          >
            <div className="flex items-end justify-between gap-2">
              <div className="flex flex-col gap-1.5">
                <CategoryBadge
                  category={item.category}
                  onUpdate={onUpdateCategory ? (c) => onUpdateCategory(item.id, c) : undefined}
                />
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
});
