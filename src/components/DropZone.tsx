import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { categories } from "../lib/categories";
import { useUpload } from "../hooks/useUpload";
import type { Category, TasteItem } from "../lib/types";

interface DropZoneProps {
  children: React.ReactNode;
  onAdd: (item: TasteItem) => void;
}

interface PendingFile {
  file: File;
  preview: string;
}

export function DropZone({ children, onAdd }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState<PendingFile | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("ui");
  const [url, setUrl] = useState("");
  const [tags, setTags] = useState("");
  const dragCounter = useRef(0);

  const handleClose = useCallback(() => {
    if (pending) URL.revokeObjectURL(pending.preview);
    setPending(null);
    setTitle("");
    setCategory("ui");
    setUrl("");
    setTags("");
  }, [pending]);

  const { uploading, upload } = useUpload(
    useCallback(
      (item: TasteItem) => {
        onAdd(item);
        handleClose();
      },
      [onAdd, handleClose]
    )
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    dragCounter.current = 0;

    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find((f) => f.type.startsWith("image/"));
    if (!imageFile) return;

    const preview = URL.createObjectURL(imageFile);
    setPending({ file: imageFile, preview });
    const name = imageFile.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
    setTitle(name);
  }, []);

  const handleUpload = useCallback(() => {
    if (!pending || !title) return;
    upload({ file: pending.file, title, category, url, tags });
  }, [pending, title, category, url, tags, upload]);

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="relative"
    >
      {children}

      <AnimatePresence>
        {dragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
            style={{
              background: "oklch(0.1 0.01 260 / 0.8)",
              border: "2px dashed oklch(0.5 0.1 200)",
            }}
          >
            <div className="flex flex-col items-center gap-3">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                style={{ color: "oklch(0.7 0.1 200)" }}
              >
                <path
                  d="M12 5v14M5 12h14"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              <p
                className="text-[15px] font-medium"
                style={{ color: "oklch(0.7 0.1 200)" }}
              >
                Drop screenshot here
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pending && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-40"
              style={{ background: "oklch(0.08 0.01 260 / 0.7)" }}
              onClick={handleClose}
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
              <h2 className="mb-4 text-[17px] font-semibold">
                Add Screenshot
              </h2>
              <img
                src={pending.preview}
                alt="Preview"
                className="mb-4 max-h-48 w-full rounded-lg object-contain"
                style={{ background: "var(--color-surface-0)" }}
              />
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
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
                <div className="mt-1 flex justify-end gap-2">
                  <button
                    onClick={handleClose}
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
                    disabled={uploading || !title}
                    className="rounded-lg px-4 py-2 text-[13px] font-medium transition-colors duration-150 disabled:opacity-40"
                    style={{
                      background: "var(--color-text-primary)",
                      color: "var(--color-surface-0)",
                    }}
                  >
                    {uploading ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
