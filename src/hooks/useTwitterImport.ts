import { useState, useCallback } from "react";
import type { Category, TasteItem, TwitterBookmark } from "../lib/types";

export function useTwitterImport(onImported: (items: TasteItem[]) => void) {
  const [bookmarks, setBookmarks] = useState<TwitterBookmark[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  const fetchBookmarks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/twitter-bookmarks");
      if (!res.ok) throw new Error("Failed to fetch bookmarks");
      const data = await res.json();
      setBookmarks(data.bookmarks);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const importSelected = useCallback(
    async (
      selected: Map<string, { bookmark: TwitterBookmark; mediaIdx: number }>,
      category: Category,
      tags: string[]
    ) => {
      setImporting(true);
      setError("");

      const items = Array.from(selected.values()).map(({ bookmark, mediaIdx }) => {
        const media = bookmark.mediaObjects[mediaIdx];
        const title = bookmark.text.slice(0, 80).replace(/https?:\/\/\S+/g, "").trim() || `@${bookmark.authorHandle}`;
        return {
          imageUrl: media.url,
          title,
          category,
          tags,
          sourceUrl: `https://x.com/${bookmark.authorHandle}/status/${bookmark.id}`,
        };
      });

      try {
        const res = await fetch("/api/import/twitter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        });
        if (!res.ok) throw new Error("Import failed");
        const data = await res.json();
        onImported(data.imported);
      } catch (err) {
        setError(String(err));
      } finally {
        setImporting(false);
      }
    },
    [onImported]
  );

  return { bookmarks, loading, importing, error, fetchBookmarks, importSelected };
}
