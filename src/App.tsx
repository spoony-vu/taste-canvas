import { useState, useMemo, useCallback, useRef } from "react";
import { FilterBar } from "./components/FilterBar";
import { SearchInput } from "./components/SearchInput";
import { CardGrid } from "./components/CardGrid";
import { AddButton } from "./components/AddButton";
import { AddModal } from "./components/AddModal";
import { ImageUploadModal } from "./components/ImageUploadModal";
import { Lightbox } from "./components/Lightbox";
import { DropZone } from "./components/DropZone";
import { UndoToast } from "./components/UndoToast";
import { useManifest } from "./hooks/useManifest";
import type { Category, TasteItem } from "./lib/types";

export default function App() {
  const { manifest, loading, addItem, removeItem, confirmDelete, restoreItem } = useManifest();
  const [activeFilters, setActiveFilters] = useState<Set<Category>>(new Set());
  const [search, setSearch] = useState("");
  const [urlModalOpen, setUrlModalOpen] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [lightboxItem, setLightboxItem] = useState<TasteItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TasteItem | null>(null);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const toggleFilter = useCallback((cat: Category) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setActiveFilters(new Set());
  }, []);

  const handleDelete = useCallback((id: string) => {
    // If there's already a pending delete, confirm it immediately
    if (pendingDelete) {
      confirmDelete(pendingDelete.id);
      clearTimeout(pendingTimerRef.current);
    }
    const removed = removeItem(id);
    if (removed) setPendingDelete(removed);
  }, [pendingDelete, removeItem, confirmDelete]);

  const handleUndo = useCallback(() => {
    if (pendingDelete) {
      restoreItem(pendingDelete);
      setPendingDelete(null);
      clearTimeout(pendingTimerRef.current);
    }
  }, [pendingDelete, restoreItem]);

  const handleExpire = useCallback(() => {
    if (pendingDelete) {
      confirmDelete(pendingDelete.id);
      setPendingDelete(null);
    }
  }, [pendingDelete, confirmDelete]);

  const filtered = useMemo(() => {
    let items = manifest.items;

    if (activeFilters.size > 0) {
      items = items.filter((item) => activeFilters.has(item.category));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return items;
  }, [manifest.items, activeFilters, search]);

  return (
    <DropZone onAdd={addItem}>
    <div className="min-h-screen px-6 pb-12 pt-6">
      <header className="mb-6 flex items-center justify-between gap-4">
        <h1
          className="text-[24px] italic tracking-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Taste Canvas
        </h1>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} />
          <AddButton
            onAddUrl={() => setUrlModalOpen(true)}
            onAddImage={() => setImageModalOpen(true)}
          />
        </div>
      </header>

      <div className="mb-6">
        <FilterBar
          active={activeFilters}
          items={manifest.items}
          filteredCount={filtered.length}
          onToggle={toggleFilter}
          onClear={clearFilters}
        />
      </div>

      <CardGrid
        items={filtered}
        loading={loading}
        totalCount={manifest.items.length}
        onDelete={handleDelete}
        onZoom={setLightboxItem}
        onClearFilters={clearFilters}
      />

      <AddModal
        open={urlModalOpen}
        onClose={() => setUrlModalOpen(false)}
        onAdd={addItem}
      />

      <ImageUploadModal
        open={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        onAdd={addItem}
      />

      <Lightbox
        item={lightboxItem}
        onClose={() => setLightboxItem(null)}
      />

      <UndoToast
        title={pendingDelete?.title ?? null}
        onUndo={handleUndo}
        onExpire={handleExpire}
      />
    </div>
    </DropZone>
  );
}
