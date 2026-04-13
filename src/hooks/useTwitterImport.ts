import { useState, useCallback } from "react";
import type { Category, TasteItem, TwitterBookmark } from "../lib/types";

export function useTwitterImport(onImported: (items: TasteItem[]) => void) {
  const [bookmarks, setBookmarks] = useState<TwitterBookmark[]>([]);
  const [bookmarksAvailable, setBookmarksAvailable] = useState(true);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  const fetchBookmarks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/twitter-bookmarks");
      if (!res.ok) {
        setBookmarksAvailable(false);
        return;
      }
      const data = await res.json();
      setBookmarks(data.bookmarks);
    } catch {
      setBookmarksAvailable(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const importFromUrl = useCallback(
    async (tweetUrl: string, category: Category, tags: string[]) => {
      setImporting(true);
      setError("");
      try {
        const res = await fetch("/api/tweet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: tweetUrl, category, tags }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: "Import failed" }));
          throw new Error(data.error || "Import failed");
        }
        const data = await res.json();
        onImported(data.imported);
        return true;
      } catch (err) {
        setError(String(err instanceof Error ? err.message : err));
        return false;
      } finally {
        setImporting(false);
      }
    },
    [onImported]
  );

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

  return {
    bookmarks,
    bookmarksAvailable,
    loading,
    importing,
    error,
    fetchBookmarks,
    importFromUrl,
    importSelected,
  };
}
