import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { categories } from "../lib/categories";
import { useUpload } from "../hooks/useUpload";
import type { Category, TasteItem } from "../lib/types";

interface ImageUploadModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (item: TasteItem) => void;
}

export function ImageUploadModal({ open, onClose, onAdd }: ImageUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("ui");
  const [url, setUrl] = useState("");
  const [tags, setTags] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const { uploading, upload } = useUpload(
    useCallback(
      (item: TasteItem) => {
        onAdd(item);
        onClose();
      },
      [onAdd, onClose]
    )
  );

  useEffect(() => {
    if (open) {
      setTimeout(() => fileRef.current?.click(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      if (preview) URL.revokeObjectURL(preview);
      setFile(null);
      setPreview("");
      setTitle("");
      setCategory("ui");
      setUrl("");
      setTags("");
    }
  }, [open]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !f.type.startsWith("image/")) {
      onClose();
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    const name = f.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
    setTitle(name);
  }, [onClose]);

  const handleUpload = useCallback(() => {
    if (!file || !title) return;
    upload({ file, title, category, url, tags });
  }, [file, title, category, url, tags, upload]);

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <AnimatePresence>
        {open && file && (
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
              <h2 className="mb-4 text-[17px] font-semibold">Add Image</h2>
              <img
                src={preview}
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
    </>
  );
}
