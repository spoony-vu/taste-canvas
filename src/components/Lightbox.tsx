import { useEffect, useCallback, useState, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { categories, categoryMap } from "../lib/categories";
import { CategoryBadge } from "./CategoryBadge";
import { imageUrl, thumbUrl } from "../lib/image";
import type { Category, TasteItem } from "../lib/types";

interface LightboxProps {
  item: TasteItem | null;
  onClose: () => void;
  onUpdateTags?: (id: string, tags: string[]) => void;
  onUpdateCategory?: (id: string, category: Category) => void;
}

// Shared element spring — physically modeled for buttery smoothness.
// Stiffness 300 + damping 30 + mass 0.8 gives ~280ms settle time with minimal overshoot.
// Matches TasteCard's layoutTransition so both directions feel consistent.
const heroSpring = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
  mass: 0.8,
};

// Content fades in after the layout spring has mostly settled (~250ms delay).
const contentReveal = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] as const, delay: 0.25 },
};

export function Lightbox({ item, onClose, onUpdateTags, onUpdateCategory }: LightboxProps) {
  const [isTall, setIsTall] = useState(false);
  const [src, setSrc] = useState("");
  const [fullLoaded, setFullLoaded] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [closing, setClosing] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const reduced = useReducedMotion();
  const isVideo = !!item?.video;

  // Two-phase close for videos: fade out video (200ms), then unmount so poster morphs back.
  const handleCloseRequest = useCallback(() => {
    if (isVideo && !closing) {
      setClosing(true);
    } else {
      onClose();
    }
  }, [isVideo, closing, onClose]);

  // Ref keeps handleKey stable so the keydown effect doesn't re-run when closing changes.
  // Without this, closing → handleCloseRequest change → handleKey change → keydown effect
  // re-runs → setClosing(false) on line 85 resets closing before the 200ms timer fires.
  const closeRef = useRef(handleCloseRequest);
  closeRef.current = handleCloseRequest;

  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => {
      setClosing(false);
      onClose();
    }, 200);
    return () => clearTimeout(timer);
  }, [closing, onClose]);

  const addTag = useCallback(() => {
    const tag = tagInput.trim().toLowerCase();
    if (!tag || !item || !onUpdateTags) return;
    if (item.tags.includes(tag)) { setTagInput(""); return; }
    onUpdateTags(item.id, [...item.tags, tag]);
    setTagInput("");
  }, [tagInput, item, onUpdateTags]);

  const removeTag = useCallback((tag: string) => {
    if (!item || !onUpdateTags) return;
    onUpdateTags(item.id, item.tags.filter((t) => t !== tag));
  }, [item, onUpdateTags]);

  // Keyboard listener — separate effect so onClose identity changes don't reset image loading
  useEffect(() => {
    if (!item) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [item, onClose]);

  // Extract primitives so the effect doesn't re-run when the item object reference
  // changes (e.g. manifest refetch, tag edit) — only when a different item is opened.
  const itemId = item?.id;
  const itemImage = item?.image;
  const itemThumb = item?.thumb;

  useEffect(() => {
    if (!itemId || !itemImage) return;
    setIsTall(false);
    setFullLoaded(false);
    const thumbSrc = thumbUrl(itemThumb, itemImage);
    setSrc(thumbSrc);
    const fullSrc = imageUrl(itemImage);
    // If thumb and full resolve to the same URL, skip preload and clear blur immediately
    if (fullSrc === thumbSrc) {
      setFullLoaded(true);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) {
        setSrc(fullSrc);
        setFullLoaded(true);
      }
    };
    img.onerror = () => {
      // Full image failed — show thumbnail without blur instead of staying blurry forever
      if (!cancelled) setFullLoaded(true);
    };
    img.src = fullSrc;
    // Safety-net timeout — clear blur after 4s no matter what
    const timer = setTimeout(() => {
      if (!cancelled) setFullLoaded(true);
    }, 4000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      img.src = "";
    };
  }, [itemId, itemImage, itemThumb]);

  const handleLoad = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    const ratio = img.naturalHeight / img.naturalWidth;
    setIsTall(ratio > 1.8);
  }, []);

  const cat = item ? categoryMap[item.category] : null;
  const hasUrl = item?.url && item.url.length > 0;

  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Category-based tag suggestions: show categories not already in tags
  const suggestions = item
    ? categories.filter((c) => c.id !== item.category && !item.tags.includes(c.id))
    : [];

  // Filter suggestions by input text
  const filteredSuggestions = tagInput.trim()
    ? suggestions.filter((c) => c.label.toLowerCase().includes(tagInput.toLowerCase()))
    : suggestions;

  useEffect(() => {
    if (!showSuggestions) return;
    function handleClick(e: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)
          && tagInputRef.current && !tagInputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [showSuggestions]);

  const addCategoryTag = useCallback((catId: string) => {
    if (!item || !onUpdateTags) return;
    if (!item.tags.includes(catId)) {
      onUpdateTags(item.id, [...item.tags, catId]);
    }
    setTagInput("");
    setShowSuggestions(false);
  }, [item, onUpdateTags]);

  const tagSection = item && onUpdateTags && (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {item.tags.map((tag) => {
        const tagCat = categoryMap[tag as Category];
        return (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{
              background: tagCat
                ? `color-mix(in oklch, ${tagCat.dot}, transparent 85%)`
                : "var(--color-surface-2)",
              color: tagCat ? tagCat.color : "var(--color-text-secondary)",
            }}
          >
            {tagCat && (
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: tagCat.dot }} />
            )}
            {tagCat ? tagCat.label : tag}
            <button
              onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
              className="ml-0.5 opacity-50 transition-opacity duration-100 hover:opacity-100"
            >
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </span>
        );
      })}
      <div className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowSuggestions((s) => !s);
            setTimeout(() => tagInputRef.current?.focus(), 60);
          }}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[13px] transition-colors duration-100"
          style={{
            background: showSuggestions ? "var(--color-surface-3)" : "var(--color-surface-2)",
            color: "var(--color-text-tertiary)",
          }}
          title="Add category tag"
        >
          +
        </button>
        <AnimatePresence>
          {showSuggestions && (
            <motion.div
              ref={suggestionsRef}
              initial={{ opacity: 0, y: -4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.96 }}
              transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
              className="absolute bottom-full left-0 z-50 mb-2 overflow-hidden rounded-xl py-1"
              style={{
                background: "var(--color-surface-2)",
                boxShadow: "0 12px 32px oklch(0 0 0 / 0.5), 0 0 0 0.5px var(--color-border)",
                minWidth: 180,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-2 pb-1 pt-1.5">
                <input
                  ref={tagInputRef}
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (filteredSuggestions.length > 0) {
                        addCategoryTag(filteredSuggestions[0].id);
                      } else if (tagInput.trim()) {
                        addTag();
                        setShowSuggestions(false);
                      }
                    }
                    if (e.key === "Escape") {
                      setShowSuggestions(false);
                    }
                  }}
                  placeholder="Filter or type..."
                  className="h-7 w-full rounded-md border-none px-2 text-[12px] outline-none"
                  style={{ background: "var(--color-surface-0)", color: "var(--color-text-primary)" }}
                />
              </div>
              <div className="max-h-[200px] overflow-y-auto scrollbar-none">
                {filteredSuggestions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); addCategoryTag(c.id); }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-[12px] transition-colors duration-75"
                    style={{ color: "var(--color-text-secondary)", background: "transparent" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "oklch(1 0 0 / 0.04)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: c.dot }} />
                    {c.label}
                  </button>
                ))}
                {filteredSuggestions.length === 0 && tagInput.trim() && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); addTag(); setShowSuggestions(false); }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-[12px] transition-colors duration-75"
                    style={{ color: "var(--color-text-tertiary)", background: "transparent" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "oklch(1 0 0 / 0.04)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    Add "{tagInput.trim()}"
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  const imageStyle = {
    boxShadow: "0 32px 64px oklch(0 0 0 / 0.5)",
    willChange: "transform" as const,
    backfaceVisibility: "hidden" as const,
  };

  const blurStyle = !isVideo
    ? {
        filter: fullLoaded || reduced ? "blur(0)" : "blur(8px)",
        transition: "filter 0.4s ease-out",
      }
    : {};

  return (
    <>
      {/* Backdrop — fades in fast (150ms) so context establishes before layout spring settles */}
      <AnimatePresence>
        {item && (
          <motion.div
            key="lightbox-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.15, ease: "easeOut" }}
            className="fixed inset-0 z-50"
            style={{ background: "oklch(0.06 0.01 260 / 0.95)" }}
            onClick={handleCloseRequest}
          />
        )}
      </AnimatePresence>

      {/* Hero image — OUTSIDE AnimatePresence so layoutId isn't disrupted */}
      {item && cat && (
        <>
          {isTall ? (
            <div
              className="fixed inset-0 z-50 overflow-y-auto scrollbar-none"
              onClick={handleCloseRequest}
            >
              <div
                className="mx-auto max-w-3xl px-4 py-16"
                onClick={(e) => e.stopPropagation()}
              >
                <motion.img
                  ref={imgRef}
                  layoutId={`image-${item.id}`}
                  src={src}
                  alt={item.title}
                  className="w-full rounded-xl"
                  style={{ ...imageStyle, ...blurStyle }}
                  transition={heroSpring}
                />
                <motion.div
                  className="sticky bottom-4 mt-4 flex flex-col items-center gap-2"
                  initial={contentReveal.initial}
                  animate={contentReveal.animate}
                  transition={reduced ? { duration: 0 } : contentReveal.transition}
                >
                  <div
                    className="flex flex-col items-center gap-2 rounded-2xl px-4 py-3"
                    style={{
                      background: "oklch(0.15 0.01 260 / 0.9)",
                      backdropFilter: "blur(12px)",
                      boxShadow: "0 4px 16px oklch(0 0 0 / 0.3)",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <CategoryBadge
                        category={item.category}
                        onUpdate={onUpdateCategory ? (c) => onUpdateCategory(item.id, c) : undefined}
                      />
                      <span
                        className="text-[16px]"
                        style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-display)" }}
                      >
                        {item.title}
                      </span>
                      {hasUrl && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[12px] font-medium transition-colors duration-150"
                          style={{
                            background: "var(--color-surface-2)",
                            color: "var(--color-text-secondary)",
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          Visit
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                            <path d="M6 3h7v7M13 3L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </a>
                      )}
                    </div>
                    {tagSection}
                  </div>
                </motion.div>
              </div>
            </div>
          ) : (
            <div
              className="fixed inset-4 z-50 flex items-center justify-center"
              onClick={handleCloseRequest}
            >
              <div
                className="relative flex max-h-full max-w-full flex-col items-center"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="relative">
                  <motion.img
                    ref={isVideo ? undefined : imgRef}
                    layoutId={`image-${item.id}`}
                    src={src}
                    alt={item.title}
                    onLoad={isVideo ? undefined : handleLoad}
                    className="max-h-[calc(100vh-120px)] max-w-[calc(100vw-64px)] rounded-xl object-contain"
                    style={{ ...imageStyle, ...(isVideo ? {} : blurStyle) }}
                    transition={heroSpring}
                  />
                  <AnimatePresence>
                    {isVideo && !closing && (
                      <motion.video
                        key="lightbox-video"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1, transition: { duration: 0.3, delay: 0.35 } }}
                        exit={{ opacity: 0, transition: { duration: 0.2 } }}
                        src={item.video}
                        autoPlay
                        loop
                        muted
                        playsInline
                        controls
                        className="absolute inset-0 h-full w-full rounded-xl object-contain"
                      />
                    )}
                  </AnimatePresence>
                </div>
                <motion.div
                  className="mt-4 flex flex-col items-center"
                  initial={contentReveal.initial}
                  animate={contentReveal.animate}
                  transition={reduced ? { duration: 0 } : contentReveal.transition}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium"
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
                    <span
                      className="text-[16px]"
                      style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-display)" }}
                    >
                      {item.title}
                    </span>
                    {hasUrl && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[12px] font-medium transition-colors duration-150"
                        style={{
                          background: "var(--color-surface-2)",
                          color: "var(--color-text-secondary)",
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        Visit
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                          <path d="M6 3h7v7M13 3L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </a>
                    )}
                  </div>
                  {tagSection}
                </motion.div>
              </div>
            </div>
          )}

          {/* Close button — fades in with content, not instantly */}
          <motion.button
            onClick={handleCloseRequest}
            className="fixed right-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-150"
            style={{
              background: "var(--color-surface-2)",
              color: "var(--color-text-secondary)",
            }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={reduced ? { duration: 0 } : { duration: 0.15, delay: 0.2, ease: "easeOut" }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </motion.button>
        </>
      )}
    </>
  );
}
