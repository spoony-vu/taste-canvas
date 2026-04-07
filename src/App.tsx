import { useState, useMemo, useCallback } from "react";
import { FilterBar } from "./components/FilterBar";
import { SearchInput } from "./components/SearchInput";
import { CardGrid } from "./components/CardGrid";
import { AddButton } from "./components/AddButton";
import { AddModal } from "./components/AddModal";
import { ImageUploadModal } from "./components/ImageUploadModal";
import { Lightbox } from "./components/Lightbox";
import { DropZone } from "./components/DropZone";
import { useManifest } from "./hooks/useManifest";
import type { Category, TasteItem } from "./lib/types";

export default function App() {
  const { manifest, loading, addItem, removeItem } = useManifest();
  const [activeFilters, setActiveFilters] = useState<Set<Category>>(new Set());
  const [search, setSearch] = useState("");
  const [urlModalOpen, setUrlModalOpen] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [lightboxItem, setLightboxItem] = useState<TasteItem | null>(null);

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

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p style={{ color: "var(--color-text-tertiary)" }}>Loading...</p>
      </div>
    );
  }

  return (
    <DropZone onAdd={addItem}>
    <div className="min-h-screen px-6 pb-12 pt-6">
      <header className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-[20px] font-semibold tracking-tight">
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
          onToggle={toggleFilter}
          onClear={clearFilters}
        />
      </div>

      <div
        className="mb-3 text-[12px]"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        {filtered.length} item{filtered.length !== 1 ? "s" : ""}
      </div>

      <CardGrid
        items={filtered}
        onDelete={removeItem}
        onZoom={setLightboxItem}
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
    </div>
    </DropZone>
  );
}
