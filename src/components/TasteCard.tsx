import { memo, useState, useCallback, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { categoryMap } from "../lib/categories";
import { thumbUrl } from "../lib/image";
import { TagPopover } from "./TagPopover";
import type { LayoutMode, TasteItem } from "../lib/types";

const TagIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M2.5 8.8V3.5a1 1 0 011-1h5.3a1 1 0 01.7.3l4.2 4.2a1 1 0 010 1.4l-5.3 5.3a1 1 0 01-1.4 0L2.8 9.5a1 1 0 01-.3-.7z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="6" cy="6" r="1" fill="currentColor" />
  </svg>
);

interface TasteCardProps {
  item: TasteItem;
  index: number;
  layoutMode?: LayoutMode;
  masonrySpan?: number;
  onMeasure?: (id: string, el: HTMLImageElement | HTMLVideoElement) => void;
  onDelete: (id: string) => void;
  onArchive?: (id: string) => void;
  onZoom: (item: TasteItem) => void;
  onUpdateTags?: (id: string, tags: string[]) => void;
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
  onArchive,
  onZoom,
  onUpdateTags,
}: TasteCardProps) {
  const cat = categoryMap[item.category];
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
          opacity: item.hidden ? 0.4 : undefined,
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
        {onUpdateTags && (
          <div className="absolute right-1.5 top-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            <TagPopover
              tags={item.tags}
              onUpdate={(tags) => onUpdateTags(item.id, tags)}
            >
              {({ onClick, isOpen }) => (
                <button
                  onClick={onClick}
                  className="flex h-7 w-7 items-center justify-center rounded-full transition-colors duration-100"
                  style={{
                    background: isOpen ? "oklch(0.3 0.01 260 / 0.9)" : "oklch(0.1 0.01 260 / 0.7)",
                    color: item.tags.length > 0 ? "oklch(0.85 0.1 200)" : "white",
                  }}
                  title="Edit tags"
                >
                  <TagIcon />
                </button>
              )}
            </TagPopover>
          </div>
        )}
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
          opacity: item.hidden ? 0.4 : undefined,
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
            <span
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
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
            <p className="truncate text-[13px] font-medium" style={{ color: "var(--color-text-primary)" }}>
              {item.title}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {onUpdateTags && (
              <TagPopover
                tags={item.tags}
                onUpdate={(tags) => onUpdateTags(item.id, tags)}
              >
                {({ onClick, isOpen }) => (
                  <button
                    onClick={onClick}
                    className="rounded p-1 transition-opacity duration-150"
                    style={{
                      color: isOpen || item.tags.length > 0
                        ? "var(--color-text-primary)"
                        : "var(--color-text-tertiary)",
                    }}
                    title="Edit tags"
                  >
                    <TagIcon />
                  </button>
                )}
              </TagPopover>
            )}
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
            {onArchive ? (
              <button
                onClick={(e) => { e.stopPropagation(); onArchive(item.id); }}
                className="rounded p-1 transition-opacity duration-150"
                style={{ color: "var(--color-text-tertiary)" }}
                title={item.hidden ? "Unarchive" : "Archive"}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  {item.hidden ? (
                    <path d="M2 4h12M3 4v8.5a1.5 1.5 0 001.5 1.5h7a1.5 1.5 0 001.5-1.5V4M6 7l2 2 2-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  ) : (
                    <path d="M2 4h12M3 4v8.5a1.5 1.5 0 001.5 1.5h7a1.5 1.5 0 001.5-1.5V4M6 8h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  )}
                </svg>
              </button>
            ) : (
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
            )}
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
        opacity: item.hidden ? 0.4 : undefined,
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
                {onUpdateTags && (
                  <TagPopover
                    tags={item.tags}
                    onUpdate={(tags) => onUpdateTags(item.id, tags)}
                  >
                    {({ onClick, isOpen }) => (
                      <button
                        onClick={onClick}
                        className="rounded p-1 opacity-60 transition-opacity duration-150 hover:opacity-100"
                        style={{
                          color: isOpen || item.tags.length > 0
                            ? "oklch(0.85 0.1 200)"
                            : "var(--color-text-primary)",
                        }}
                        title="Edit tags"
                      >
                        <TagIcon />
                      </button>
                    )}
                  </TagPopover>
                )}
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
                {onArchive ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onArchive(item.id);
                    }}
                    className="rounded p-1 opacity-60 transition-opacity duration-150 hover:opacity-100"
                    style={{ color: "var(--color-text-primary)" }}
                    title={item.hidden ? "Unarchive" : "Archive"}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      {item.hidden ? (
                        <path d="M2 4h12M3 4v8.5a1.5 1.5 0 001.5 1.5h7a1.5 1.5 0 001.5-1.5V4M6 7l2 2 2-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                      ) : (
                        <path d="M2 4h12M3 4v8.5a1.5 1.5 0 001.5 1.5h7a1.5 1.5 0 001.5-1.5V4M6 8h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                      )}
                    </svg>
                  </button>
                ) : (
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
                )}
              </div>
            </div>
          </div>
        </div>
      </button>
    </motion.div>
  );
});
