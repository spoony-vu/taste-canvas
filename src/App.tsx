import { useState, useMemo, useCallback, useRef, lazy, Suspense } from "react";
import { LayoutGroup } from "framer-motion";
import { FilterBar } from "./components/FilterBar";
import { SearchInput } from "./components/SearchInput";
import { CardGrid } from "./components/CardGrid";
import { AddButton } from "./components/AddButton";
import { DropZone } from "./components/DropZone";
import { ViewToolbar } from "./components/ViewToolbar";

const AddModal = lazy(() => import("./components/AddModal").then(m => ({ default: m.AddModal })));
const ImageUploadModal = lazy(() => import("./components/ImageUploadModal").then(m => ({ default: m.ImageUploadModal })));
import { Lightbox } from "./components/Lightbox";
const TwitterImportModal = lazy(() => import("./components/TwitterImportModal").then(m => ({ default: m.TwitterImportModal })));
import { UndoToast } from "./components/UndoToast";
import { useManifest } from "./hooks/useManifest";
import type { Category, LayoutMode, TasteItem } from "./lib/types";

function acceptedFiles(files: FileList | null): File[] {
  return Array.from(files ?? []).filter(
    (f) => f.type.startsWith("image/") || f.type.startsWith("video/")
  );
}

const isMobile = typeof window !== "undefined" && window.innerWidth <= 640;

function readStoredLayout(): LayoutMode {
  try {
    const v = localStorage.getItem("taste-layout");
    if (v === "grid" || v === "feed" || v === "masonry") return v;
  } catch { /* noop */ }
  return isMobile ? "feed" : "masonry";
}

export default function App() {
  const { manifest, loading, addItem, addItems, removeItem, confirmDelete, restoreItem, archiveItem, unarchiveItem } = useManifest();
  const [activeFilters, setActiveFilters] = useState<Set<Category>>(new Set());
  const [search, setSearch] = useState("");
  const [urlModalOpen, setUrlModalOpen] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [twitterModalOpen, setTwitterModalOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lightboxItem, setLightboxItem] = useState<TasteItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TasteItem | null>(null);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(readStoredLayout);
  const [showArchived, setShowArchived] = useState(false);

  const handleLayoutChange = useCallback((mode: LayoutMode) => {
    setLayoutMode(mode);
    try { localStorage.setItem("taste-layout", mode); } catch { /* noop */ }
  }, []);

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

  const handleArchive = useCallback((id: string) => {
    const item = manifest.items.find((i) => i.id === id);
    if (item?.hidden) {
      unarchiveItem(id);
    } else {
      archiveItem(id);
    }
  }, [manifest.items, archiveItem, unarchiveItem]);

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

  const archivedCount = useMemo(
    () => manifest.items.filter((i) => i.hidden).length,
    [manifest.items]
  );

  const filtered = useMemo(() => {
    let items = manifest.items;

    if (!showArchived) {
      items = items.filter((item) => !item.hidden);
    }

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
  }, [manifest.items, activeFilters, search, showArchived]);

  const handleTwitterImported = useCallback((items: TasteItem[]) => {
    addItems(items);
    setTwitterModalOpen(false);
  }, [addItems]);

  const openFileInput = useCallback(() => fileInputRef.current?.click(), []);

  return (
    <DropZone onAdd={addItem}>
    <div className="min-h-screen px-4 pb-24 pt-4 sm:px-6 sm:pt-6">
      <header className="mb-6 flex items-center justify-between gap-4">
        <h1
          className="text-[24px] italic tracking-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Taste Canvas
        </h1>
        <div className="flex items-center gap-3">
          <SearchInput value={search} onChange={setSearch} />
          <div className="hidden sm:block">
            <AddButton
              onAddUrl={() => setUrlModalOpen(true)}
              onAddImage={openFileInput}
              onAddTwitter={() => setTwitterModalOpen(true)}
            />
          </div>
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

      <LayoutGroup>
        <CardGrid
          items={filtered}
          loading={loading}
          totalCount={manifest.items.length}
          layoutMode={layoutMode}
          lightboxId={lightboxItem?.id}
          onDelete={handleDelete}
          onArchive={handleArchive}
          onZoom={setLightboxItem}
          onClearFilters={clearFilters}
        />

        {lightboxItem && (
          <Lightbox
            item={lightboxItem}
            onClose={() => setLightboxItem(null)}
          />
        )}
      </LayoutGroup>

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

        {twitterModalOpen && (
          <TwitterImportModal
            open={twitterModalOpen}
            onClose={() => setTwitterModalOpen(false)}
            onImported={handleTwitterImported}
          />
        )}
      </Suspense>

      <UndoToast
        title={pendingDelete?.title ?? null}
        onUndo={handleUndo}
        onExpire={handleExpire}
      />

      <ViewToolbar
        layoutMode={layoutMode}
        onLayoutChange={handleLayoutChange}
        showArchived={showArchived}
        onToggleArchived={() => setShowArchived((p) => !p)}
        archivedCount={archivedCount}
        onAddUrl={() => setUrlModalOpen(true)}
        onAddImage={openFileInput}
      />
    </div>
    </DropZone>
  );
}
