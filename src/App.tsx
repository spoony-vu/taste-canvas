import { useState, useMemo, useCallback, useRef, lazy, Suspense } from "react";
import { FilterBar } from "./components/FilterBar";
import { SearchInput } from "./components/SearchInput";
import { CardGrid } from "./components/CardGrid";
import { AddButton } from "./components/AddButton";
import { DropZone } from "./components/DropZone";

const AddModal = lazy(() => import("./components/AddModal").then(m => ({ default: m.AddModal })));
const ImageUploadModal = lazy(() => import("./components/ImageUploadModal").then(m => ({ default: m.ImageUploadModal })));
const Lightbox = lazy(() => import("./components/Lightbox").then(m => ({ default: m.Lightbox })));
import { UndoToast } from "./components/UndoToast";
import { useManifest } from "./hooks/useManifest";
import type { Category, TasteItem } from "./lib/types";

function acceptedFiles(files: FileList | null): File[] {
  return Array.from(files ?? []).filter(
    (f) => f.type.startsWith("image/") || f.type.startsWith("video/")
  );
}

export default function App() {
  const { manifest, loading, addItem, removeItem, confirmDelete, restoreItem } = useManifest();
  const [activeFilters, setActiveFilters] = useState<Set<Category>>(new Set());
  const [search, setSearch] = useState("");
  const [urlModalOpen, setUrlModalOpen] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    if (pendingDelete) {
      clearTimeout(pendingTimerRef.current);
    }
    const removed = removeItem(id);
    if (removed) {
      setPendingDelete(removed);
      confirmDelete(id);
    }
  }, [pendingDelete, removeItem, confirmDelete]);

  const handleUndo = useCallback(() => {
    if (pendingDelete) {
      restoreItem(pendingDelete);
      setPendingDelete(null);
      clearTimeout(pendingTimerRef.current);
    }
  }, [pendingDelete, restoreItem]);

  const handleExpire = useCallback(() => {
    setPendingDelete(null);
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
            onAddImage={() => fileInputRef.current?.click()}
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

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = acceptedFiles(e.target.files);
          e.target.value = "";
          if (files.length > 0) {
            setPendingFiles(files);
            setImageModalOpen(true);
          }
        }}
      />

      <Suspense>
        {urlModalOpen && (
          <AddModal
            open={urlModalOpen}
            onClose={() => setUrlModalOpen(false)}
            onAdd={addItem}
          />
        )}

        {imageModalOpen && pendingFiles.length > 0 && (
          <ImageUploadModal
            open={imageModalOpen}
            files={pendingFiles}
            onClose={() => {
              setImageModalOpen(false);
              setPendingFiles([]);
            }}
            onAdd={addItem}
          />
        )}

        {lightboxItem && (
          <Lightbox
            item={lightboxItem}
            onClose={() => setLightboxItem(null)}
          />
        )}
      </Suspense>

      <UndoToast
        title={pendingDelete?.title ?? null}
        onUndo={handleUndo}
        onExpire={handleExpire}
      />
    </div>
    </DropZone>
  );
}
