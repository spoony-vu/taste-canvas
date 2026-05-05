# Privacy

Taste Canvas is built so that your visual references stay yours. Each fork is fully isolated. There is no shared server, no central database, no telemetry, and no analytics.

## Where your data lives

- **Images and videos** you upload, screenshot, or capture go directly to the **Vercel Blob store** auto-provisioned in **your** Vercel account when you clicked "Deploy with Vercel."
- **The manifest** (every item's title, URL, category, tags, dimensions, and reference to its blob) is stored as a single JSON file (`taste/manifest.json`) inside the same Blob store.
- **Nothing** is stored anywhere else. There is no upstream copy. There is no telemetry endpoint. The author of this project has zero access to your deployment.

If you delete the Vercel project, your data is gone. If you fork this repo and deploy your own, your data is yours alone — the original deployer has no view into it.

## Authentication

Write endpoints (`POST /api/upload`, `PUT /api/manifest`, `DELETE /api/delete`, `POST /api/screenshot`, `POST /api/tweet`) require either:

- A **bearer token** matching `TASTE_API_KEY` (used by the browser extension and any external script), OR
- A **same-origin** request (used by the browser frontend — Vite serves the same domain as the API)

Requests that present neither are rejected with `401`. If you forget to set `TASTE_API_KEY` in production, the API is open — set it before sharing your URL.

## Outbound network calls

The application makes outbound network requests **only when you explicitly ask it to:**

| Trigger | Destination | What is sent |
|---------|-------------|--------------|
| Saving a regular URL | The user-supplied URL | A standard browser-style HTTP request to read `og:title` / `og:image` |
| Capturing a URL screenshot | The user-supplied URL | A puppeteer-controlled headless Chromium loads the page server-side |
| Importing a tweet URL | `api.fxtwitter.com` | The tweet's status ID, to fetch media metadata |
| Loading the page | `fonts.googleapis.com`, `fonts.gstatic.com` | Static font request for Geist Mono. Self-host the font in `public/` and update `index.html` if you want zero third-party calls |

That's the complete list. There are no analytics, error reporters, A/B testing services, or any other background calls.

## Browser extension

The companion [Chrome extension](https://github.com/YOUR_USERNAME/taste-canvas-extension) is configured per-user — it talks ONLY to the backend URL you set in its Settings panel. The API key is stored in `chrome.storage.sync` (encrypted in transit by Google as part of profile sync) and is never sent to anyone except your backend. The extension does not phone home.

## What the project author can see

Nothing. This is the entire point. There is no central server to log to. The original author of `taste-canvas` cannot see your manifest, your images, your tags, your usage, or even that you exist. Every fork is an independent island.

## Data export

Your manifest is a JSON file at `taste/manifest.json` in your Blob store. You can read it any time via `GET /api/manifest` (with your bearer token), or directly through the Vercel dashboard's Blob browser. Images are individually addressable URLs in the same Blob store. There is no proprietary format and no lock-in.

## Reporting issues

If you find a privacy or security issue with the codebase, open an issue on GitHub or contact the maintainer privately. The faster a leak is fixed in the upstream code, the sooner every fork benefits.
