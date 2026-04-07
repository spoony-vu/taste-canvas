import { useEffect, useCallback, useState, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { categoryMap } from "../lib/categories";
import { imageUrl, thumbUrl } from "../lib/image";
import type { TasteItem } from "../lib/types";

interface LightboxProps {
  item: TasteItem | null;
  onClose: () => void;
}

export function Lightbox({ item, onClose }: LightboxProps) {
  const [isTall, setIsTall] = useState(false);
  const [src, setSrc] = useState("");
  const imgRef = useRef<HTMLImageElement>(null);
  const reduced = useReducedMotion();
  const dur = reduced ? 0 : 0.2;

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
      // Start with thumbnail, then load full-res in background
      setSrc(thumbUrl(item.thumb, item.image));
      const fullSrc = imageUrl(item.image);
      const img = new Image();
      img.onload = () => setSrc(fullSrc);
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

  return (
    <AnimatePresence>
      {item && cat && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: dur }}
            className="fixed inset-0 z-50"
            style={{ background: "oklch(0.06 0.01 260 / 0.95)" }}
            onClick={onClose}
          />

          {isTall ? (
            /* Scrollable full-width view for tall/strip images */
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: reduced ? 0 : 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-0 z-50 overflow-y-auto scrollbar-none"
              onClick={onClose}
            >
              <div
                className="mx-auto max-w-3xl px-4 py-16"
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  ref={imgRef}
                  src={src}
                  alt={item.title}
                  className="w-full rounded-xl"
                  style={{ boxShadow: "0 32px 64px oklch(0 0 0 / 0.5)" }}
                />
                <div className="sticky bottom-4 mt-4 flex items-center justify-center gap-3">
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
                </div>
              </div>
            </motion.div>
          ) : (
            /* Standard centered lightbox for normal images */
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: reduced ? 0 : 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-4 z-50 flex items-center justify-center"
              onClick={onClose}
            >
              <div
                className="relative flex max-h-full max-w-full flex-col items-center"
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  ref={imgRef}
                  src={src}
                  alt={item.title}
                  onLoad={handleLoad}
                  className="max-h-[calc(100vh-120px)] max-w-[calc(100vw-64px)] rounded-xl object-contain"
                  style={{ boxShadow: "0 32px 64px oklch(0 0 0 / 0.5)" }}
                />
                <div className="mt-4 flex items-center gap-3">
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
              </div>
            </motion.div>
          )}

          <button
            onClick={onClose}
            className="fixed right-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-150"
            style={{
              background: "var(--color-surface-2)",
              color: "var(--color-text-secondary)",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </>
      )}
    </AnimatePresence>
  );
}
