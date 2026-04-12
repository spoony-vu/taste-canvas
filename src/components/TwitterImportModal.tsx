import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { categories } from "../lib/categories";
import { useTwitterImport } from "../hooks/useTwitterImport";
import type { Category, TasteItem, TwitterBookmark } from "../lib/types";

interface TwitterImportModalProps {
  open: boolean;
  onClose: () => void;
  onImported: (items: TasteItem[]) => void;
}

export function TwitterImportModal({ open, onClose, onImported }: TwitterImportModalProps) {
  const { bookmarks, loading, importing, error, fetchBookmarks, importSelected } =
    useTwitterImport(onImported);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Map<string, { bookmark: TwitterBookmark; mediaIdx: number }>>(new Map());
  const [category, setCategory] = useState<Category>("ui");
  const [tags, setTags] = useState("");

  useEffect(() => {
    if (open) fetchBookmarks();
  }, [open, fetchBookmarks]);

  const filtered = useMemo(() => {
    if (!search.trim()) return bookmarks;
    const q = search.toLowerCase();
    return bookmarks.filter(
      (b) =>
        b.text.toLowerCase().includes(q) ||
        b.authorHandle.toLowerCase().includes(q) ||
        b.authorName.toLowerCase().includes(q)
    );
  }, [bookmarks, search]);

  const toggleSelect = useCallback((bookmark: TwitterBookmark, mediaIdx: number) => {
    const key = `${bookmark.id}-${mediaIdx}`;
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.set(key, { bookmark, mediaIdx });
      }
      return next;
    });
  }, []);

  const handleImport = useCallback(() => {
    const parsedTags = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    importSelected(selected, category, parsedTags);
  }, [selected, category, tags, importSelected]);

  const handleClose = useCallback(() => {
    setSelected(new Map());
    setSearch("");
    onClose();
  }, [onClose]);

  return (
    <AnimatePresence>
      {open && (
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
            className="fixed left-1/2 top-1/2 z-50 flex h-[min(85vh,720px)] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl"
            style={{
              background: "var(--color-surface-1)",
              boxShadow: "0 24px 48px oklch(0 0 0 / 0.4), 0 0 0 0.5px var(--color-border)",
              color: "var(--color-text-primary)",
            }}
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <h2 className="text-[17px] font-semibold">Import from Twitter</h2>
              <button
                onClick={handleClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-150"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="px-6 pb-3">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search bookmarks..."
                className="h-9 w-full rounded-lg border-none px-3 text-[14px] outline-none"
                style={{
                  background: "var(--color-surface-0)",
                  color: "var(--color-text-primary)",
                }}
              />
            </div>

            <div className="flex-1 overflow-y-auto px-6 scrollbar-none">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <p className="text-[14px]" style={{ color: "var(--color-text-tertiary)" }}>
                    Loading bookmarks...
                  </p>
                </div>
              ) : error ? (
                <div className="flex items-center justify-center py-16">
                  <p className="text-[14px]" style={{ color: "oklch(0.7 0.15 30)" }}>
                    {error}
                  </p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex items-center justify-center py-16">
                  <p className="text-[14px]" style={{ color: "var(--color-text-tertiary)" }}>
                    {bookmarks.length === 0
                      ? "No bookmarks with\u00A0media\u00A0found"
                      : "No matching\u00A0bookmarks"}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 pb-4">
                  {filtered.map((bookmark) =>
                    bookmark.mediaObjects.map((media, mediaIdx) => {
                      const key = `${bookmark.id}-${mediaIdx}`;
                      const isSelected = selected.has(key);
                      return (
                        <button
                          key={key}
                          onClick={() => toggleSelect(bookmark, mediaIdx)}
                          className="group relative overflow-hidden rounded-lg text-left transition-[transform,box-shadow] duration-150"
                          style={{
                            aspectRatio: "4/3",
                            boxShadow: isSelected
                              ? "0 0 0 2px oklch(0.7 0.15 200)"
                              : "0 0 0 0px transparent",
                          }}
                        >
                          <img
                            src={media.url}
                            alt={bookmark.text.slice(0, 40)}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                          <div
                            className="absolute inset-0 flex items-end p-1.5 opacity-0 transition-opacity duration-100 group-hover:opacity-100"
                            style={{
                              background: "linear-gradient(to top, oklch(0.1 0.01 260 / 0.8), transparent 60%)",
                            }}
                          >
                            <p className="truncate text-[10px] text-white">
                              @{bookmark.authorHandle}
                            </p>
                          </div>
                          {isSelected && (
                            <div
                              className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full"
                              style={{ background: "oklch(0.7 0.15 200)" }}
                            >
                              <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                                <path d="M3 8l4 4 6-8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </div>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {selected.size > 0 && (
              <div
                className="flex items-center gap-3 border-t px-6 py-4"
                style={{ borderColor: "var(--color-border)" }}
              >
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Category)}
                  className="h-9 rounded-lg border-none px-2.5 text-[13px] outline-none"
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
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="Tags"
                  className="h-9 flex-1 rounded-lg border-none px-2.5 text-[13px] outline-none"
                  style={{
                    background: "var(--color-surface-0)",
                    color: "var(--color-text-primary)",
                  }}
                />
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="h-9 rounded-lg px-4 text-[13px] font-medium transition-colors duration-150 disabled:opacity-40"
                  style={{
                    background: "var(--color-text-primary)",
                    color: "var(--color-surface-0)",
                  }}
                >
                  {importing
                    ? "Importing..."
                    : `Import ${selected.size}`}
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
