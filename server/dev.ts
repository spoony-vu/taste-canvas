/**
 * Local development server.
 *
 * Wraps the Vercel serverless handlers in api/*.ts so they can be hit from
 * Vite's dev proxy at http://localhost:3002. The api/*.ts files are the
 * single source of truth — Vercel deploys them directly in production, and
 * this dev server mounts the same handlers locally with no logic of its own.
 */
import express from "express";
import cors from "cors";
import type { Request, Response } from "express";

const app = express();
const PORT = Number(process.env.PORT ?? 3002);

app.use(cors());
// Default JSON parser; upload.ts disables body parsing itself via its config export
app.use((req, res, next) => {
  if (req.path === "/api/upload") return next();
  express.json({ limit: "20mb" })(req, res, next);
});

type Handler = (req: Request, res: Response) => unknown | Promise<unknown>;

async function loadHandler(modPath: string): Promise<Handler> {
  const mod = (await import(modPath)) as { default: Handler };
  return mod.default;
}

function mount(path: string, modPath: string) {
  app.all(path, async (req, res) => {
    try {
      const handler = await loadHandler(modPath);
      // Express req/res are compatible with VercelRequest/VercelResponse
      // for the surface our handlers use (headers, query, body, status, json, setHeader)
      await handler(req, res);
    } catch (err) {
      console.error(`[${path}]`, err);
      if (!res.headersSent) {
        res.status(500).json({ error: String(err) });
      }
    }
  });
}

mount("/api/manifest", "../api/manifest.js");
mount("/api/delete", "../api/delete.js");
mount("/api/upload", "../api/upload.js");
mount("/api/screenshot", "../api/screenshot.js");
mount("/api/tweet", "../api/tweet.js");
mount("/api/meta", "../api/meta.js");

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`taste-canvas dev API listening on http://localhost:${PORT}`);
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.warn(
      "[warn] BLOB_READ_WRITE_TOKEN is not set — uploads and manifest writes will fail.\n" +
        "       Add it to .env.local. See .env.example."
    );
  }
});
