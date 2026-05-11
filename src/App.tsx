import { useState, useMemo, useCallback, useRef, lazy, Suspense, useEffect } from "react";
import { LayoutGroup, useReducedMotion } from "framer-motion";
import { FilterBar } from "./components/FilterBar";
import { SearchInput } from "./components/SearchInput";
import { CardGrid } from "./components/CardGrid";
import { AddButton } from "./components/AddButton";
import { DropZone } from "./components/DropZone";
import { ViewToolbar } from "./components/ViewToolbar";
import { ThemeToggle } from "./components/ThemeToggle";
import { FlowerLogo } from "./components/FlowerLogo";

const AddModal = lazy(() => import("./components/AddModal").then(m => ({ default: m.AddModal })));
const ImageUploadModal = lazy(() => import("./components/ImageUploadModal").then(m => ({ default: m.ImageUploadModal })));
import { Lightbox } from "./components/Lightbox";
import { UndoToast } from "./components/UndoToast";
import { useManifest } from "./hooks/useManifest";
import { useDragToScroll } from "./hooks/useDragToScroll";
import { useIncrementalItems } from "./hooks/useIncrementalItems";
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
    if (v === "grid" || v === "feed") return v;
    if (v === "masonry" && !isMobile) return v;
  } catch { /* noop */ }
  return isMobile ? "feed" : "masonry";
}

function attributeValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export default function App() {
  const { manifest, loading, addItem, addItems, removeItem, confirmDelete, restoreItem, updateItem } = useManifest();
  const [activeFilters, setActiveFilters] = useState<Set<Category>>(new Set());
  const [search, setSearch] = useState("");
  const [urlModalOpen, setUrlModalOpen] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const pendingLightboxScrollIdRef = useRef<string | null>(null);
  const backgroundScrollTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const [lightboxContextIds, setLightboxContextIds] = useState<string[]>([]);
  const [lightboxDirection, setLightboxDirection] = useState<-1 | 0 | 1>(0);
  const lightboxItem = useMemo(
    () => (lightboxId ? manifest.items.find((i) => i.id === lightboxId) ?? null : null),
    [lightboxId, manifest.items]
  );
  const [pendingDelete, setPendingDelete] = useState<TasteItem | null>(null);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(readStoredLayout);
  const reducedMotion = useReducedMotion();

  useDragToScroll(layoutMode === "grid");

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
    setSearch("");
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

  const { items: visibleItems, hasMore, sentinelRef, ensureRenderedIndex } = useIncrementalItems(filtered);

  const availableLightboxIds = useMemo(() => {
    if (!lightboxId) return [];
    const availableIds = new Set(manifest.items.map((item) => item.id));
    return lightboxContextIds.filter((id) => availableIds.has(id));
  }, [lightboxId, lightboxContextIds, manifest.items]);

  const lightboxIndex = lightboxId ? availableLightboxIds.indexOf(lightboxId) : -1;
  const canNavigatePrevious = lightboxIndex > 0;
  const canNavigateNext = lightboxIndex >= 0 && lightboxIndex < availableLightboxIds.length - 1;

  const handleOpenLightbox = useCallback((item: TasteItem) => {
    setLightboxContextIds(filtered.map((filteredItem) => filteredItem.id));
    setLightboxDirection(0);
    setLightboxId(item.id);
  }, [filtered]);

  const handleNavigatePrevious = useCallback(() => {
    if (!canNavigatePrevious) return;
    setLightboxDirection(-1);
    setLightboxId(availableLightboxIds[lightboxIndex - 1]);
  }, [availableLightboxIds, canNavigatePrevious, lightboxIndex]);

  const handleNavigateNext = useCallback(() => {
    if (!canNavigateNext) return;
    setLightboxDirection(1);
    setLightboxId(availableLightboxIds[lightboxIndex + 1]);
  }, [availableLightboxIds, canNavigateNext, lightboxIndex]);

  const scrollCardIntoBackgroundView = useCallback((
    id: string,
    options: {
      direction?: -1 | 0 | 1;
      force?: boolean;
      behavior?: ScrollBehavior;
      block?: ScrollLogicalPosition;
    } = {}
  ) => {
    const card = document.querySelector<HTMLElement>('[data-taste-card-id="' + attributeValue(id) + '"]');
    if (!card) return false;
    const rect = card.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const cardCenter = rect.top + rect.height / 2;
    const comfortTop = viewportHeight * 0.28;
    const comfortBottom = viewportHeight * 0.72;

    if (!options.force && cardCenter >= comfortTop && cardCenter <= comfortBottom) {
      return true;
    }

    if (!options.force) {
      if (options.direction === 1 && cardCenter < comfortTop) return true;
      if (options.direction === -1 && cardCenter > comfortBottom) return true;
    }

    card.scrollIntoView({
      behavior: options.behavior ?? (reducedMotion ? "auto" : "smooth"),
      block: options.block ?? "nearest",
      inline: "nearest",
    });
    return true;
  }, [reducedMotion]);

  const flushPendingBackgroundScroll = useCallback((
    options?: {
      direction?: -1 | 0 | 1;
      force?: boolean;
      behavior?: ScrollBehavior;
      block?: ScrollLogicalPosition;
    }
  ) => {
    const id = pendingLightboxScrollIdRef.current;
    if (!id) return false;
    if (!scrollCardIntoBackgroundView(id, options)) return false;
    pendingLightboxScrollIdRef.current = null;
    return true;
  }, [scrollCardIntoBackgroundView]);

  const scheduleBackgroundScroll = useCallback((id: string) => {
    pendingLightboxScrollIdRef.current = id;
    clearTimeout(backgroundScrollTimerRef.current);
    backgroundScrollTimerRef.current = setTimeout(() => {
      flushPendingBackgroundScroll({ direction: lightboxDirection });
    }, 420);
  }, [flushPendingBackgroundScroll, lightboxDirection]);

  const handleCloseLightbox = useCallback(() => {
    if (lightboxId) {
      clearTimeout(backgroundScrollTimerRef.current);
      pendingLightboxScrollIdRef.current = lightboxId;
      flushPendingBackgroundScroll({ force: true, behavior: "auto", block: "center" });
    }
    setLightboxId(null);
    setLightboxContextIds([]);
    setLightboxDirection(0);
  }, [flushPendingBackgroundScroll, lightboxId]);

  useEffect(() => {
    if (!lightboxId || lightboxDirection === 0 || lightboxIndex < 0) return;
    ensureRenderedIndex(lightboxIndex);
    scheduleBackgroundScroll(lightboxId);
  }, [ensureRenderedIndex, lightboxDirection, lightboxId, lightboxIndex, scheduleBackgroundScroll]);

  useEffect(() => {
    if (!pendingLightboxScrollIdRef.current) return;
    clearTimeout(backgroundScrollTimerRef.current);
    backgroundScrollTimerRef.current = setTimeout(() => {
      flushPendingBackgroundScroll({ direction: lightboxDirection });
    }, 120);
    return () => clearTimeout(backgroundScrollTimerRef.current);
  }, [flushPendingBackgroundScroll, lightboxDirection, visibleItems.length]);

  useEffect(() => () => clearTimeout(backgroundScrollTimerRef.current), []);

  const openFileInput = useCallback(() => fileInputRef.current?.click(), []);
  const openCameraInput = useCallback(() => cameraInputRef.current?.click(), []);

  return (
    <DropZone onAdd={addItem}>
    <div className={`min-h-screen pb-24 pt-4 sm:pt-6 ${layoutMode === "grid" ? "px-1 sm:px-2" : "px-4 sm:px-6"}`}>
      <header className="mb-6 flex items-center gap-4">
        <h1 className="flex flex-1 items-center">
          <button
            type="button"
            onClick={clearFilters}
            className="flex items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
            aria-label="Taste Canvas — reset filters"
            title="Reset filters"
          >
            <FlowerLogo size={44} className="select-none" />
            <span className="sr-only">Taste Canvas</span>
          </button>
        </h1>
        <div className="flex flex-1 justify-center">
          <SearchInput value={search} onChange={setSearch} />
        </div>
        <div className="flex flex-1 items-center justify-end gap-1.5 sm:gap-3">
          <ThemeToggle />
          <div className="hidden sm:block">
            <AddButton
              onAddUrl={() => setUrlModalOpen(true)}
              onAddImage={openFileInput}
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
          items={visibleItems}
          loading={loading}
          totalCount={manifest.items.length}
          layoutMode={layoutMode}
          onDelete={handleDelete}
          onZoom={handleOpenLightbox}
          onClearFilters={clearFilters}
          onUpdateCategory={(id, category) => updateItem(id, { category })}
        />

        {hasMore && <div ref={sentinelRef} className="h-px" aria-hidden="true" />}

        {lightboxItem && (
          <Lightbox
            item={lightboxItem}
            canNavigatePrevious={canNavigatePrevious}
            canNavigateNext={canNavigateNext}
            showNavigation={availableLightboxIds.length > 1}
            navigationDirection={lightboxDirection}
            onClose={handleCloseLightbox}
            onPrevious={handleNavigatePrevious}
            onNext={handleNavigateNext}
            onUpdateTags={(id, tags) => updateItem(id, { tags })}
            onUpdateCategory={(id, category) => updateItem(id, { category })}
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

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
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
            onAddItems={addItems}
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

      </Suspense>

      <UndoToast
        title={pendingDelete?.title ?? null}
        onUndo={handleUndo}
        onExpire={handleExpire}
      />

      <ViewToolbar
        layoutMode={layoutMode}
        onLayoutChange={handleLayoutChange}
        onAddUrl={() => setUrlModalOpen(true)}
        onAddImage={openFileInput}
        onTakePhoto={openCameraInput}
      />
    </div>
    </DropZone>
  );
}
