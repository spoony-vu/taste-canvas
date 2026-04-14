import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CategorySelect } from "./CategorySelect";
import type { Category, TasteItem } from "../lib/types";

function isTweetUrl(url: string): boolean {
  return /(?:twitter\.com|x\.com)\/\w+\/status\/\d+/.test(url);
}

interface AddModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (item: TasteItem) => void;
  onAddItems?: (items: TasteItem[]) => void;
}

export function AddModal({ open, onClose, onAdd, onAddItems }: AddModalProps) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("landing-pages");
  const [tags, setTags] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingTitle, setFetchingTitle] = useState(false);
  const [error, setError] = useState("");
  const urlRef = useRef<HTMLInputElement>(null);

  const isTweet = useMemo(() => isTweetUrl(url), [url]);

  // Default to "interactions" when a tweet URL is pasted
  useEffect(() => {
    if (isTweet && category === "landing-pages") {
      setCategory("interactions");
    }
  }, [isTweet, category]);

  useEffect(() => {
    if (open) {
      setTimeout(() => urlRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      setUrl("");
      setTitle("");
      setCategory("landing-pages");
      setTags("");
      setError("");
      setFetchingTitle(false);
    }
  }, [open]);

  const handleUrlBlur = useCallback(async () => {
    if (!url || title || isTweetUrl(url)) return;
    try {
      new URL(url);
    } catch {
      return;
    }
    setFetchingTitle(true);
    try {
      const res = await fetch(`/api/meta?url=${encodeURIComponent(url)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.title && !title) setTitle(data.title);
    } catch {
      // Silently fail — user can type title manually
    } finally {
      setFetchingTitle(false);
    }
  }, [url, title]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setError("");

    try {
      const parsedTags = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      if (isTweet) {
        const res = await fetch("/api/tweet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, category, tags: parsedTags }),
        });

        if (!res.ok) {
          let msg = `Tweet import failed (${res.status})`;
          try {
            const data = await res.json();
            if (data.error) msg = data.error;
          } catch {}
          throw new Error(msg);
        }

        const { imported } = (await res.json()) as { imported: TasteItem[] };
        if (onAddItems) {
          onAddItems(imported);
        } else {
          for (const item of imported) onAdd(item);
        }
        onClose();
      } else {
        let item: TasteItem | null = null;

        // Try screenshot first
        try {
          const res = await fetch("/api/screenshot", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, title, category, tags: parsedTags }),
          });
          if (res.ok) {
            item = await res.json();
          }
        } catch {}

        // Screenshot failed — fall back to OG image
        if (!item) {
          const metaRes = await fetch(`/api/meta?url=${encodeURIComponent(url)}`);
          const meta = metaRes.ok ? await metaRes.json() : null;

          if (meta?.image) {
            // Fetch the OG image and upload it
            const imgRes = await fetch(meta.image);
            if (!imgRes.ok) throw new Error("Failed to fetch OG image");
            const blob = await imgRes.blob();
            const form = new FormData();
            form.append("image", blob, "og-image.webp");
            form.append("title", title || meta.title || url);
            form.append("category", category);
            form.append("url", url);
            if (parsedTags.length) form.append("tags", JSON.stringify(parsedTags));

            const uploadRes = await fetch("/api/upload", { method: "POST", body: form });
            if (!uploadRes.ok) throw new Error("Upload failed");
            item = await uploadRes.json();
          } else {
            throw new Error("Screenshot failed and no OG image available");
          }
        }

        onAdd(item!);
        onClose();
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

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
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6"
            style={{
              background: "var(--color-surface-1)",
              boxShadow:
                "0 24px 48px oklch(0 0 0 / 0.4), 0 0 0 0.5px var(--color-border)",
              color: "var(--color-text-primary)",
            }}
          >
            <h2 className="mb-4 text-[17px] font-semibold">
              {isTweet ? "Import Tweet" : "Add Screenshot"}
            </h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input
                ref={urlRef}
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={handleUrlBlur}
                placeholder="https://example.com"
                required
                className="h-10 rounded-lg border-none px-3 text-[14px] outline-none"
                style={{
                  background: "var(--color-surface-0)",
                  color: "var(--color-text-primary)",
                }}
              />
              {!isTweet && (
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={fetchingTitle ? "Fetching title..." : "Title (auto-filled from URL)"}
                  className="h-10 rounded-lg border-none px-3 text-[14px] outline-none"
                  style={{
                    background: "var(--color-surface-0)",
                    color: "var(--color-text-primary)",
                  }}
                />
              )}
              <CategorySelect value={category} onChange={setCategory} />
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
                  type="button"
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
                  type="submit"
                  disabled={loading || !url}
                  className="rounded-lg px-4 py-2 text-[13px] font-medium transition-colors duration-150 disabled:opacity-40"
                  style={{
                    background: "var(--color-text-primary)",
                    color: "var(--color-surface-0)",
                  }}
                >
                  {loading
                    ? isTweet ? "Importing..." : "Capturing..."
                    : isTweet ? "Import" : "Capture"}
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
