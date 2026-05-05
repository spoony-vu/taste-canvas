# Taste Canvas

A self-hosted visual reference board for design inspiration — typefaces, landing pages, UI, branding, color palettes. Save images, capture URLs, organize by category. Your data lives in your own Vercel account.

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)

## Why

Pinboard apps and bookmark managers are centralized. Your visual references end up locked in someone else's database — sold, mined, or eventually shut down. Taste Canvas is the inverse: deploy your own copy in 60 seconds, and every image you save lives in **your** Vercel Blob store, behind **your** auth key, in **your** account. Forks don't share data.

## Features

- Save images by upload, URL screenshot, or tweet URL
- Categorize by type (typeface, UI, landing pages, branding, color palette, etc.)
- Tag and search
- Masonry, grid, and feed layouts
- Lightbox viewer with full-resolution preload
- LQIP blur placeholders + WebP thumbnails (Sharp)
- Optional Chrome extension for one-click saving from any page
- Optional PWA install for mobile camera capture IRL

## Stack

React 19 · Vite 8 · TypeScript · Tailwind v4 · Framer Motion · Vercel Blob · Sharp

## Quick start (deploy your own)

The fastest path is one-click deploy to Vercel. This creates a private project in your account with its own Blob store automatically provisioned.

> Deploy button instructions are added in Phase 4 of the OSS prep — once published as a public template repo, this README will include the official Deploy-to-Vercel button.

## Local development

```bash
git clone https://github.com/YOUR_USERNAME/taste-canvas.git
cd taste-canvas
npm install
cp .env.example .env.local   # fill in BLOB_READ_WRITE_TOKEN and TASTE_API_KEY
npm run dev
```

This starts Vite on `http://localhost:5173` and an Express dev server on `:3002`. Vite proxies `/api` to the Express server.

## Verify

```bash
npm run lint
npm run build
```

## Privacy

Each fork is fully isolated. Images go to **your** Vercel Blob store. Manifest reads/writes happen in **your** Vercel project. There is no central server, no telemetry, and no analytics. See [PRIVACY.md](./PRIVACY.md) (added in Phase 9).

## License

MIT — see [LICENSE](./LICENSE).
