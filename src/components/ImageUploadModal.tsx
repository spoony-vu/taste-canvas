import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { categories } from "../lib/categories";
import { useUpload } from "../hooks/useUpload";
import type { Category, TasteItem } from "../lib/types";

interface ImageUploadModalProps {
  open: boolean;
  files: File[];
  onClose: () => void;
  onAdd: (item: TasteItem) => void;
}

interface QueuedFile {
  file: File;
  preview: string;
  title: string;
  isVideo: boolean;
}

export function ImageUploadModal({ open, files, onClose, onAdd }: ImageUploadModalProps) {
  const initialQueue = useMemo<QueuedFile[]>(
    () =>
      files.map((f) => ({
        file: f,
        preview: URL.createObjectURL(f),
        title: f.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
        isVideo: f.type.startsWith("video/"),
      })),
    // Only build queue once on mount; files identity changes trigger a remount via key
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [queue, setQueue] = useState<QueuedFile[]>(initialQueue);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [category, setCategory] = useState<Category>("ui");
  const [url, setUrl] = useState("");
  const [tags, setTags] = useState("");
  const [uploadedCount, setUploadedCount] = useState(0);

  const { uploading, error, upload } = useUpload(
    useCallback(
      (item: TasteItem) => {
        onAdd(item);
        setUploadedCount((c) => c + 1);
      },
      [onAdd]
    )
  );

  // Auto-advance to next file after upload completes
  useEffect(() => {
    if (uploadedCount > 0 && !uploading && !error && currentIndex < queue.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else if (uploadedCount > 0 && !uploading && !error && currentIndex >= queue.length - 1 && queue.length > 0) {
      onClose();
    }
  }, [uploadedCount, uploading, error, currentIndex, queue.length, onClose]);

  // Revoke object URLs on unmount
  useEffect(() => {
    return () => {
      queue.forEach((q) => URL.revokeObjectURL(q.preview));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const current = queue[currentIndex];

  const handleUpload = useCallback(() => {
    if (!current) return;
    upload({ file: current.file, title: current.title, category, url, tags });
  }, [current, category, url, tags, upload]);

  const handleTitleChange = useCallback((newTitle: string) => {
    setQueue((prev) =>
      prev.map((q, i) => (i === currentIndex ? { ...q, title: newTitle } : q))
    );
  }, [currentIndex]);

  const remaining = queue.length - currentIndex;

  return (
    <AnimatePresence>
      {open && current && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-40"
              style={{ background: "oklch(0.08 0.01 260 / 0.7)" }}
              onClick={onClose}
            />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6"
              style={{
                background: "var(--color-surface-1)",
                boxShadow:
                  "0 24px 48px oklch(0 0 0 / 0.4), 0 0 0 0.5px var(--color-border)",
                color: "var(--color-text-primary)",
              }}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[17px] font-semibold">
                  {queue.length > 1
                    ? `Add ${current.isVideo ? "Video" : "Image"} (${currentIndex + 1}/${queue.length})`
                    : `Add ${current.isVideo ? "Video" : "Image"}`}
                </h2>
                {queue.length > 1 && (
                  <span
                    className="text-[12px] font-medium"
                    style={{ color: "var(--color-text-tertiary)" }}
                  >
                    {remaining} remaining
                  </span>
                )}
              </div>
              {current.isVideo ? (
                <video
                  src={current.preview}
                  muted
                  autoPlay
                  loop
                  playsInline
                  className="mb-4 max-h-48 w-full rounded-lg object-contain"
                  style={{ background: "var(--color-surface-0)" }}
                />
              ) : (
                <img
                  src={current.preview}
                  alt="Preview"
                  className="mb-4 max-h-48 w-full rounded-lg object-contain"
                  style={{ background: "var(--color-surface-0)" }}
                />
              )}
              {/* Thumbnail strip for multi-file */}
              {queue.length > 1 && (
                <div className="mb-4 flex gap-1.5 overflow-x-auto scrollbar-none">
                  {queue.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => !uploading && setCurrentIndex(i)}
                      className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-md transition-opacity duration-100"
                      style={{
                        opacity: i < currentIndex ? 0.3 : i === currentIndex ? 1 : 0.6,
                        outline: i === currentIndex ? "2px solid var(--color-text-primary)" : "none",
                        outlineOffset: "-2px",
                      }}
                    >
                      {q.isVideo ? (
                        <div
                          className="flex h-full w-full items-center justify-center text-[8px]"
                          style={{ background: "var(--color-surface-0)", color: "var(--color-text-tertiary)" }}
                        >
                          VID
                        </div>
                      ) : (
                        <img src={q.preview} alt="" className="h-full w-full object-cover" />
                      )}
                      {i < uploadedCount && (
                        <div className="absolute inset-0 flex items-center justify-center" style={{ background: "oklch(0.2 0.1 145 / 0.6)" }}>
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                            <path d="M3 8l4 4 6-8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  value={current.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Title"
                  autoFocus
                  className="h-10 rounded-lg border-none px-3 text-[14px] outline-none"
                  style={{
                    background: "var(--color-surface-0)",
                    color: "var(--color-text-primary)",
                  }}
                />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Category)}
                  className="h-10 rounded-lg border-none px-3 text-[14px] outline-none"
                  style={{
                    background: "var(--color-surface-0)",
                    color: "var(--color-text-primary)",
                  }}
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Source URL (optional)"
                  className="h-10 rounded-lg border-none px-3 text-[14px] outline-none"
                  style={{
                    background: "var(--color-surface-0)",
                    color: "var(--color-text-primary)",
                  }}
                />
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="Tags (comma-separated)"
                  className="h-10 rounded-lg border-none px-3 text-[14px] outline-none"
                  style={{
                    background: "var(--color-surface-0)",
                    color: "var(--color-text-primary)",
                  }}
                />
                {error && (
                  <p className="text-[13px]" style={{ color: "oklch(0.7 0.2 25)" }}>
                    {error}
                  </p>
                )}
                <div className="mt-1 flex justify-end gap-2">
                  <button
                    onClick={onClose}
                    className="rounded-lg px-4 py-2 text-[13px] font-medium transition-colors duration-150"
                    style={{
                      background: "var(--color-surface-2)",
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={uploading || !current.title}
                    className="rounded-lg px-4 py-2 text-[13px] font-medium transition-colors duration-150 disabled:opacity-40"
                    style={{
                      background: "var(--color-text-primary)",
                      color: "var(--color-surface-0)",
                    }}
                  >
                    {uploading
                      ? "Saving..."
                      : queue.length > 1
                        ? `Save (${currentIndex + 1}/${queue.length})`
                        : "Save"}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
  );
}
