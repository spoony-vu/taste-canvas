# Taste Canvas

Visual design reference board — save, categorize, and browse design inspiration (typefaces, landing pages, UI, branding, color palettes, etc.).

## Stack

- React 19 + Vite 8 + TypeScript 6
- Tailwind CSS v4 (via `@tailwindcss/vite`)
- Framer Motion 12 (layout animations, lightbox)
- Express 5 backend (local dev) / Vercel Serverless Functions (production)
- Vercel Blob for image storage in production
- Sharp for thumbnails + LQIP generation
- Playwright/Puppeteer for URL screenshots (local only)

## Dev Server

```bash
npm run dev          # Starts Vite (port 5173) + Express server (port 3002) concurrently
npm run dev:web      # Vite only
npm run dev:server   # Express only
```

Vite proxies `/api` requests to `http://localhost:3002`.

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
    useManifest.ts           # CRUD operations on manifest (add, remove, restore, archive)
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
    ViewToolbar.tsx          # Layout mode + archive toggle (bottom bar)
    DropZone.tsx             # Drag-and-drop wrapper
    UndoToast.tsx            # Delete undo notification
server/
  index.ts                   # Express app — all API routes
  storage.ts                 # Filesystem (local) / Vercel Blob (prod) abstraction
  screenshot.ts              # Playwright URL screenshot capture
  thumbnail.ts               # Sharp thumbnail + LQIP generation
api/
  manifest.ts                # GET/PUT manifest (Vercel serverless)
  upload.ts                  # POST upload (Vercel serverless)
  delete.ts                  # DELETE item (Vercel serverless)
  meta.ts                    # GET URL metadata (Vercel serverless)
  screenshot.ts              # POST screenshot (Vercel serverless)
  _auth.ts                   # Auth helper
```

## Key Types

```ts
type Category = "typeface" | "symbol" | "landing-pages" | "interactions" | "color-palette" | "patterns" | "branding" | "ui" | "graphics";
type LayoutMode = "masonry" | "grid" | "feed";
interface TasteItem { id, title, url, image, thumb?, lqip?, video?, category, tags, added, hidden? }
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
| DELETE | `/api/manifest/:id` | Delete item + image |
| POST | `/api/upload` | Upload image file (multipart) |
| POST | `/api/screenshot` | Capture URL screenshot (local only) |
| GET | `/api/meta` | Fetch og:title from URL |
| GET | `/api/images/:category/:filename` | Serve images (local only) |
| GET | `/api/twitter-bookmarks` | List Twitter bookmarks with media |
| POST | `/api/import/twitter` | Import Twitter media to vault |

## Gotchas

- **Local vs Vercel storage**: `isBlob` flag in `server/storage.ts` switches between filesystem and Vercel Blob. Screenshots only work locally (Playwright not available on Vercel).
- **Wiki auto-sync**: The server auto-updates `~/Library/Mobile Documents/com~apple~CloudDocs/obsidian-vault/spoony-vu/taste-board.md` on every manifest change (local only).
- **Delete endpoint**: `DELETE /api/manifest/:id` (path param, not query param). Also deletes the image from storage.
- **File upload size**: Compress/resize client-side before upload. Vercel has 4MB limit. Always show upload errors — never let it hang silently.
- **Twitter import**: `mediaObjects[].url` from `~/.ft-bookmarks/bookmarks.jsonl` for real images. Filter by size (>50KB) to skip avatars.
- **Lightbox image preload effect deps**: The preload effect in `Lightbox.tsx` must depend on primitive values (`item.id`, `item.image`, `item.thumb`), NOT the `item` object. The `lightboxItem` useMemo in `App.tsx` returns a new object reference whenever `manifest.items` changes (background refetch, tag edits, etc.), which re-triggers object-dep effects and resets `fullLoaded` — causing the blur to persist. Always use `onerror` + a timeout safety net on `new Image()` preloads.

## Related Wiki Pages

- `taste-board.md` — Auto-generated index of all items
- `taste/color.md`, `taste/typography.md` — Design taste preferences
