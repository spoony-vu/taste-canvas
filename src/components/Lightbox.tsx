import { useEffect, useCallback, useState, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { categoryMap } from "../lib/categories";
import { imageUrl, thumbUrl } from "../lib/image";
import type { TasteItem } from "../lib/types";

interface LightboxProps {
  item: TasteItem | null;
  onClose: () => void;
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

export function Lightbox({ item, onClose }: LightboxProps) {
  const [isTall, setIsTall] = useState(false);
  const [src, setSrc] = useState("");
  const [fullLoaded, setFullLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const reduced = useReducedMotion();
  const isVideo = !!item?.video;

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (item) {
      window.addEventListener("keydown", handleKey);
      document.body.style.overflow = "hidden";
      setIsTall(false);
      setFullLoaded(false);
      setSrc(thumbUrl(item.thumb, item.image));
      const fullSrc = imageUrl(item.image);
      const img = new Image();
      img.onload = () => {
        setSrc(fullSrc);
        setFullLoaded(true);
      };
      img.src = fullSrc;
    }
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [item, handleKey]);

  const handleLoad = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    const ratio = img.naturalHeight / img.naturalWidth;
    setIsTall(ratio > 1.8);
  }, []);

  const cat = item ? categoryMap[item.category] : null;
  const hasUrl = item?.url && item.url.length > 0;

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
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Hero image — OUTSIDE AnimatePresence so layoutId isn't disrupted */}
      {item && cat && (
        <>
          {isTall ? (
            <div
              className="fixed inset-0 z-50 overflow-y-auto scrollbar-none"
              onClick={onClose}
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
                  className="sticky bottom-4 mt-4 flex items-center justify-center gap-3"
                  initial={contentReveal.initial}
                  animate={contentReveal.animate}
                  transition={reduced ? { duration: 0 } : contentReveal.transition}
                >
                  <div
                    className="flex items-center gap-3 rounded-full px-4 py-2"
                    style={{
                      background: "oklch(0.15 0.01 260 / 0.9)",
                      backdropFilter: "blur(12px)",
                      boxShadow: "0 4px 16px oklch(0 0 0 / 0.3)",
                    }}
                  >
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
                </motion.div>
              </div>
            </div>
          ) : (
            <div
              className="fixed inset-4 z-50 flex items-center justify-center"
              onClick={onClose}
            >
              <div
                className="relative flex max-h-full max-w-full flex-col items-center"
                onClick={(e) => e.stopPropagation()}
              >
                {isVideo ? (
                  <motion.video
                    layoutId={`image-${item.id}`}
                    src={item.video}
                    autoPlay
                    loop
                    muted
                    playsInline
                    controls
                    className="max-h-[calc(100vh-120px)] max-w-[calc(100vw-64px)] rounded-xl"
                    style={imageStyle}
                    transition={heroSpring}
                  />
                ) : (
                  <motion.img
                    ref={imgRef}
                    layoutId={`image-${item.id}`}
                    src={src}
                    alt={item.title}
                    onLoad={handleLoad}
                    className="max-h-[calc(100vh-120px)] max-w-[calc(100vw-64px)] rounded-xl object-contain"
                    style={{ ...imageStyle, ...blurStyle }}
                    transition={heroSpring}
                  />
                )}
                <motion.div
                  className="mt-4 flex items-center gap-3"
                  initial={contentReveal.initial}
                  animate={contentReveal.animate}
                  transition={reduced ? { duration: 0 } : contentReveal.transition}
                >
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
                </motion.div>
              </div>
            </div>
          )}

          {/* Close button — fades in with content, not instantly */}
          <motion.button
            onClick={onClose}
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
