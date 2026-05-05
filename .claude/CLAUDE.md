# Taste Canvas

Visual design reference board — save, categorize, and browse design inspiration (typefaces, landing pages, UI, branding, color palettes, etc.).

## Stack

- React 19 + Vite 8 + TypeScript 6
- Tailwind CSS v4 (via `@tailwindcss/vite`)
- Framer Motion 12 (layout animations, lightbox)
- Vercel Serverless Functions (single source of truth in `api/*.ts`)
- Local dev: thin Express adapter (`server/dev.ts`) mounts the same `api/*.ts` handlers — no logic, just routing
- Vercel Blob for image storage (both local and prod)
- Sharp for thumbnails + LQIP generation
- puppeteer-core + @sparticuz/chromium for URL screenshots

## Dev Server

```bash
npm run dev          # Starts Vite (port 5173) + dev API adapter (port 3002) concurrently
npm run dev:web      # Vite only
npm run dev:api      # API adapter only
```

Vite proxies `/api` requests to `http://localhost:3002`. The API adapter (`server/dev.ts`) just mounts `api/*.ts` handlers — no separate backend logic exists. Same code runs locally and on Vercel.

## Verify

```bash
npm run build        # tsc -b && vite build
npm run lint         # eslint
```

## File Structure

```
src/
  App.tsx                    # Root — filter, search, layout mode, modals, lightbox
  main.tsx                   # Entry point
  index.css                  # Tailwind + global styles
  lib/
    types.ts                 # TasteItem, Manifest, Category, LayoutMode, TwitterBookmark
    categories.ts            # Category metadata
    image.ts                 # Image processing helpers
  hooks/
    useManifest.ts           # CRUD operations on manifest (add, remove, restore, update)
    useUpload.ts             # File upload logic
    useImageDimensions.ts    # Image dimension detection
    useTwitterImport.ts      # Twitter/X bookmark import
  components/
    CardGrid.tsx             # Grid/masonry/feed layout
    TasteCard.tsx            # Individual card with thumbnail, LQIP, actions
    FilterBar.tsx            # Category filter chips
    SearchInput.tsx          # Search field
    AddButton.tsx            # Add dropdown (URL, image, Twitter)
    AddModal.tsx             # URL capture modal (lazy loaded)
    ImageUploadModal.tsx     # File upload modal (lazy loaded)
    TwitterImportModal.tsx   # Twitter import modal (lazy loaded)
    Lightbox.tsx             # Fullscreen image viewer
    ViewToolbar.tsx          # Layout mode switcher + mobile add button (bottom bar)
    DropZone.tsx             # Drag-and-drop wrapper
    UndoToast.tsx            # Delete undo notification
server/
  dev.ts                     # Local dev adapter — mounts api/*.ts handlers on Express
api/
  manifest.ts                # GET/PUT manifest
  upload.ts                  # POST file upload (multipart)
  delete.ts                  # DELETE item by id
  meta.ts                    # GET URL og:title metadata
  screenshot.ts              # POST URL screenshot (puppeteer-core + chromium)
  tweet.ts                   # POST tweet URL import (fxtwitter)
  _auth.ts                   # Bearer token + same-origin auth
  _storage.ts                # Shared Blob helpers (readManifest, uploadImageWithThumb, etc.)
```

## Key Types

```ts
type Category = "typeface" | "symbol" | "landing-pages" | "interactions" | "color-palette" | "patterns" | "branding" | "ui" | "graphics" | "tools";
type LayoutMode = "masonry" | "grid" | "feed";
interface TasteItem { id, title, url, image, thumb?, lqip?, video?, category, tags, added }
interface Manifest { items: TasteItem[] }
```

## Conventions

- `useManifest` hook is the single source of truth for items. All mutations go through it.
- Modals are lazy-loaded with `React.lazy()` + `Suspense`.
- Categories are fixed — defined in `lib/types.ts` and mirrored in `server/index.ts` for directory creation.
- Item IDs are 8-char UUIDs (`crypto.randomUUID().slice(0, 8)`).
- Thumbnails follow naming: `thumbFilename(filename)` adds `-thumb` suffix.
- LQIP is a base64 data URL stored inline in manifest.

## API Routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/manifest` | Read manifest |
| PUT | `/api/manifest` | Write full manifest |
| DELETE | `/api/delete?id=<id>` | Delete item + blob assets |
| POST | `/api/upload` | Upload image/video (multipart) |
| POST | `/api/screenshot` | Capture URL screenshot |
| POST | `/api/tweet` | Import media from tweet URL |
| GET | `/api/meta` | Fetch og:title from URL |

## Gotchas

- **Single backend**: `api/*.ts` is the source of truth. Vercel deploys them directly; `server/dev.ts` mounts them on Express for local dev. No filesystem fallback — Blob is required (set `BLOB_READ_WRITE_TOKEN` in `.env.local`).
- **Delete endpoint**: `DELETE /api/delete?id=<id>` (query param). Also deletes blob assets.
- **File upload size**: Compress/resize client-side before upload. Vercel has 4MB limit. Always show upload errors — never let it hang silently.
- **Twitter import**: `mediaObjects[].url` from `~/.ft-bookmarks/bookmarks.jsonl` for real images. Filter by size (>50KB) to skip avatars.
- **Lightbox image preload effect deps**: The preload effect in `Lightbox.tsx` must depend on primitive values (`item.id`, `item.image`, `item.thumb`), NOT the `item` object. The `lightboxItem` useMemo in `App.tsx` returns a new object reference whenever `manifest.items` changes (background refetch, tag edits, etc.), which re-triggers object-dep effects and resets `fullLoaded` — causing the blur to persist. Always use `onerror` + a timeout safety net on `new Image()` preloads.
- **Dual backend routes**: Every API call must work on BOTH local Express (`server/index.ts`) and Vercel Functions (`api/*.ts`). The client calls one URL — if a route exists in only one backend, the other silently 404s. Always add/check both when touching endpoints.
- **Dropdown portals**: `CategoryBadge` and `CategorySelect` dropdowns MUST use `createPortal(…, document.body)` with `position: fixed`. TasteCard (masonry/grid/feed) and modal containers all have `overflow: hidden` — absolute-positioned dropdowns get clipped. Always calculate position from `getBoundingClientRect()` in `useLayoutEffect`, flip if near viewport edge.

## Related Wiki Pages

- `taste-board.md` — Auto-generated index of all items
- `taste/color.md`, `taste/typography.md` — Design taste preferences
