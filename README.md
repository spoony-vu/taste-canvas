# Taste Canvas

A self-hosted visual reference board for design inspiration — typefaces, landing pages, UI, branding, color palettes. Save images, capture URLs, organize by category. Your data lives in your own Vercel account.

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)

## Why

Pinboard apps and bookmark managers are centralized. Your visual references end up locked in someone else's database — sold, mined, or eventually shut down. Taste Canvas is the inverse: deploy your own copy and every image you save lives in **your** Vercel Blob store, behind **your** auth key, in **your** account. Forks don't share data.

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

React 19 · Vite 8 · TypeScript · Tailwind v4 · Framer Motion · Vercel Blob · Sharp · puppeteer-core + @sparticuz/chromium

## Quick start: deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FYOUR_USERNAME%2Ftaste-canvas&project-name=taste-canvas&repository-name=taste-canvas&stores=%5B%7B%22type%22%3A%22blob%22%7D%5D&env=TASTE_API_KEY%2CVITE_PUBLIC_URL&envDescription=TASTE_API_KEY%20is%20any%20random%20string%20%28openssl%20rand%20-hex%2032%29.%20VITE_PUBLIC_URL%20is%20your%20deployed%20origin%20%28e.g.%20https%3A%2F%2Fyour-taste-canvas.vercel.app%29.&envLink=https%3A%2F%2Fgithub.com%2FYOUR_USERNAME%2Ftaste-canvas%23environment-variables)

The button above will:

1. Clone this repo into your GitHub account
2. Create a new Vercel project linked to it
3. **Auto-provision a Vercel Blob store** (this is where your images and manifest will live — only you can read/write it)
4. Prompt you for `TASTE_API_KEY` and `VITE_PUBLIC_URL`
5. Deploy

After deploy, visit your site URL and start saving images. There is no signup, no shared backend, and no telemetry.

## Environment variables

| Name | Required | What |
|------|----------|------|
| `BLOB_READ_WRITE_TOKEN` | yes | Auto-set by the Vercel Blob integration. Don't set manually. |
| `TASTE_API_KEY` | yes (in prod) | Bearer token used by the browser extension and any external script. Generate with `openssl rand -hex 32`. The frontend uses same-origin auth, so it doesn't need to know this value. |
| `VITE_PUBLIC_URL` | recommended | Your deployed origin (`https://your-app.vercel.app`). Used for `og:url` and `og:image` tags. |

Copy `.env.example` to `.env.local` for local dev, and set the same variables in **Vercel → your project → Settings → Environment Variables** for production.

## Local development

```bash
git clone https://github.com/YOUR_USERNAME/taste-canvas.git
cd taste-canvas
npm install

# Connect to your Vercel project to pull the Blob token automatically:
npx vercel link
npx vercel env pull .env.local

# Or copy .env.example and fill in by hand
# cp .env.example .env.local

npm run dev
```

This starts Vite on `http://localhost:5173` and a thin API adapter on `:3002`. Vite proxies `/api` to the adapter, which mounts the same `api/*.ts` handlers Vercel deploys in production — single source of truth, no drift.

## Verify

```bash
npm run lint
npm run build
```

## Architecture

- **`api/*.ts`** — Vercel serverless functions. The only backend code in the project.
- **`server/dev.ts`** — Local Express adapter that mounts `api/*.ts` handlers. Zero logic of its own.
- **`api/_storage.ts`** — Shared Blob helpers (`readManifest`, `writeManifest`, `uploadImageWithThumb`, etc.) used by every handler.
- **`api/_auth.ts`** — Bearer-token + same-origin auth. Both paths are required: same-origin for the browser frontend, Bearer for the extension and any scripts.
- **`src/`** — React frontend. State lives in `useManifest` hook (single source of truth on the client).

## Browser extension

A companion Chrome extension lets you save any image, video, link, or page screenshot to your taste canvas with one click, a hover button, or a keyboard shortcut. It reads your backend URL + API key from its own Settings panel — each fork uses its own deployment, with no shared server.

Source + install instructions: **[taste-canvas-extension](https://github.com/YOUR_USERNAME/taste-canvas-extension)**.

## Mobile / PWA

Taste Canvas installs as a Progressive Web App on iOS and Android, with full-screen standalone display and a custom home-screen icon.

**iOS:** open the deployed URL in Safari → Share → **Add to Home Screen**.
**Android:** open in Chrome → menu → **Install app** (or **Add to Home screen**).

Once installed, the camera button in the add menu opens the device camera directly so you can capture references IRL — physical typography, packaging, signage, anything. Captured photos go straight into your Vercel Blob, just like uploads.

## Privacy

Each fork is fully isolated. Images go to **your** Vercel Blob store. Manifest reads/writes happen in **your** Vercel project. There is no central server, no telemetry, and no analytics. See [PRIVACY.md](./PRIVACY.md) for details.

## License

MIT — see [LICENSE](./LICENSE).
