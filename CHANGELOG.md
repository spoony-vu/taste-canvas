# Changelog

## 2026-04-13

### Fixed: Lightbox images staying blurry forever

Images opened in the lightbox showed the LQIP blur placeholder but never loaded
the full-resolution image. Two root causes:

1. **No `onerror` on full-image preload** — `new Image()` had no error handler,
   so if the full-size image failed to load (404, network error), `fullLoaded`
   never became `true` and the `blur(8px)` CSS filter stayed permanently.

2. **Effect re-running from unstable object reference** — The preload effect
   depended on the `item` object. `useManifest` re-fetches the manifest in the
   background on mount, producing a new `items` array. The `useMemo` in
   `App.tsx` then returns a new `lightboxItem` reference (via `.find()`), which
   re-triggered the effect, resetting `fullLoaded` back to `false` mid-load.

3. **Shared effect with `handleKey`** (original code) — The keyboard listener
   and image preload lived in one `useEffect` with `handleKey` (which depended
   on `onClose`) in its dep array. Any `onClose` identity change would re-run
   the entire effect and reset loading state.

**Fixes applied** (`src/components/Lightbox.tsx`):
- Split keyboard listener and image preload into separate effects
- Use primitive deps (`itemId`, `itemImage`, `itemThumb`) so the preload effect
  only re-runs when a genuinely different item is opened
- Added `img.onerror` to clear blur when the full image fails to load
- Added 4-second timeout safety net to guarantee blur always clears
- Short-circuit when thumb and full URLs are identical (no separate thumbnail)
- Proper cleanup with cancelled flag to prevent stale callbacks
