import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { captureScreenshot } from "./screenshot.js";
import { storage, isBlob } from "./storage.js";
import { generateThumbnail, generateLqip, thumbFilename } from "./thumbnail.js";

/** Strip lone Unicode surrogates that break JSON serialization */
function sanitizeText(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "\uFFFD");
}

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json());

// Ensure category subdirectories exist (local only)
if (!isBlob) {
  const CATEGORIES = [
    "typeface",
    "symbol",
    "landing-pages",
    "interactions",
    "color-palette",
    "patterns",
    "branding",
    "ui",
    "graphics",
    "tools",
  ];
  for (const cat of CATEGORIES) {
    const dir = path.join(storage.vaultDir, cat);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

// GET manifest
app.get("/api/manifest", async (_req, res) => {
  const manifest = await storage.readManifest();
  res.json(manifest);
});

// PUT manifest
app.put("/api/manifest", async (req, res) => {
  await storage.writeManifest(req.body);
  res.json({ ok: true });
});

// Serve images from vault (local only — on Vercel, images are served directly from Blob URLs)
app.get("/api/images/:category/:filename", (req, res) => {
  const filePath = storage.getLocalImagePath(
    `${req.params.category}/${req.params.filename}`
  );
  if (!filePath) {
    res.status(404).json({ error: "Image not found" });
    return;
  }
  res.sendFile(filePath);
});

// GET meta — fetch title/og:title from URL (lightweight, no browser)
app.get("/api/meta", async (req, res) => {
  const url = req.query.url as string | undefined;
  if (!url) {
    res.status(400).json({ error: "Missing url parameter" });
    return;
  }

  try {
    new URL(url);
  } catch {
    res.status(400).json({ error: "Invalid URL" });
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; TasteCanvas/1.0)",
        Accept: "text/html",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      res.status(502).json({ error: `Upstream returned ${response.status}` });
      return;
    }

    const text = await response.text();
    const head = text.slice(0, 20_000);

    const ogTitle = head.match(
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
    )?.[1];
    const ogDescription = head.match(
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i
    )?.[1];
    const ogImage = head.match(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
    )?.[1];
    const htmlTitle = head.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];

    const decode = (s: string) =>
      s
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
        .trim();

    res.json({
      title: decode(ogTitle ?? htmlTitle ?? ""),
      description: decode(ogDescription ?? ""),
      image: ogImage ? decode(ogImage) : "",
    });
  } catch (err) {
    res.status(502).json({ error: String(err) });
  }
});

// POST screenshot — capture URL, save to vault, add to manifest (local only)
app.post("/api/screenshot", async (req, res) => {
  if (isBlob) {
    res.status(501).json({ error: "Use /api/upload on Vercel — Playwright not available" });
    return;
  }

  const { url, title: providedTitle, category, tags } = req.body;

  if (!url || !category) {
    res.status(400).json({ error: "Missing url or category" });
    return;
  }

  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    const slug = hostname.replace(/\./g, "-");
    const date = new Date().toISOString().split("T")[0];
    const filename = `${slug}-${date}.png`;
    const outputPath = path.join(storage.vaultDir, category, filename);

    const meta = await captureScreenshot(url, outputPath);
    const title = providedTitle || meta.title || hostname;

    // Generate thumbnail + LQIP
    const imgBuf = fs.readFileSync(outputPath);
    const [thumbBuf, lqip] = await Promise.all([
      generateThumbnail(imgBuf),
      generateLqip(imgBuf),
    ]);
    const thumbName = thumbFilename(filename);
    fs.writeFileSync(path.join(storage.vaultDir, category, thumbName), thumbBuf);

    const manifest = await storage.readManifest();
    const id = crypto.randomUUID().slice(0, 8);
    const item = {
      id,
      title,
      url,
      image: `${category}/${filename}`,
      thumb: `${category}/${thumbName}`,
      lqip,
      category,
      tags: tags ?? [],
      added: date,
    };
    manifest.items.unshift(item);
    await storage.writeManifest(manifest);
    updateWikiTastePage(manifest);

    res.json(item);
  } catch (err) {
    console.error("Screenshot failed:", err);
    res.status(500).json({ error: String(err) });
  }
});

// POST upload — accept dropped image file, save to vault/blob, add to manifest
const upload = multer({ storage: multer.memoryStorage() });

app.post("/api/upload", upload.single("image"), async (req, res) => {
  const file = req.file;
  const { title, category, url, tags } = req.body;

  if (!file || !title || !category) {
    res.status(400).json({ error: "Missing image, title, or category" });
    return;
  }

  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const date = new Date().toISOString().split("T")[0];
  const ext = file.originalname.split(".").pop() ?? "png";
  const filename = `${slug}-${date}.${ext}`;

  const { image: imagePath, thumb: thumbPath, lqip } = await storage.uploadImage(
    category,
    filename,
    file.buffer,
    file.mimetype
  );

  const manifest = await storage.readManifest();
  const id = crypto.randomUUID().slice(0, 8);
  const item = {
    id,
    title,
    url: url ?? "",
    image: imagePath,
    thumb: thumbPath,
    lqip,
    category,
    tags: tags ? JSON.parse(tags) : [],
    added: date,
  };
  manifest.items.unshift(item);
  await storage.writeManifest(manifest);

  if (!isBlob) updateWikiTastePage(manifest);

  res.json(item);
});

// Obsidian wiki auto-update (local only)
const WIKI_DIR = path.join(
  process.env.HOME ?? "~",
  "Library/Mobile Documents/com~apple~CloudDocs/obsidian-vault/spoony-vu"
);

function updateWikiTastePage(manifest: {
  items: {
    title: string;
    url: string;
    category: string;
    tags: string[];
    added: string;
  }[];
}) {
  const tastePage = path.join(WIKI_DIR, "taste-board.md");

  const grouped: Record<string, typeof manifest.items> = {};
  for (const item of manifest.items) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  }

  const lines: string[] = [
    "---",
    "tags: [taste, design, reference]",
    `updated: ${new Date().toISOString().split("T")[0]}`,
    "---",
    "",
    "# Taste Board",
    "",
    `${manifest.items.length} items across ${Object.keys(grouped).length} categories.`,
    "",
  ];

  const categoryLabels: Record<string, string> = {
    typeface: "Typeface",
    symbol: "Symbol",
    "landing-pages": "Landing Pages",
    interactions: "Interactions",
    "color-palette": "Color Palette",
    patterns: "Patterns",
    branding: "Branding",
    ui: "UI",
    graphics: "Graphics",
    tools: "Tools",
  };

  for (const [cat, items] of Object.entries(grouped)) {
    lines.push(`## ${categoryLabels[cat] ?? cat}`);
    lines.push("");
    for (const item of items) {
      const link = item.url ? `[${item.title}](${item.url})` : item.title;
      const tags = item.tags.length > 0 ? ` — ${item.tags.join(", ")}` : "";
      lines.push(`- ${link}${tags} *(${item.added})*`);
    }
    lines.push("");
  }

  fs.writeFileSync(tastePage, lines.join("\n"));
}

// GET twitter bookmarks with media (dev-only)
app.get("/api/twitter-bookmarks", async (_req, res) => {
  const bookmarksPath = path.join(process.env.HOME ?? "~", ".ft-bookmarks/bookmarks.jsonl");
  if (!fs.existsSync(bookmarksPath)) {
    res.json({ bookmarks: [] });
    return;
  }

  const lines = fs.readFileSync(bookmarksPath, "utf-8").split("\n").filter(Boolean);
  const bookmarks = [];

  for (const line of lines) {
    try {
      const bm = JSON.parse(line);
      // Only include bookmarks with media objects that have images > 50KB
      if (!bm.mediaObjects || bm.mediaObjects.length === 0) continue;
      const hasMedia = bm.mediaObjects.some(
        (m: { type: string; width?: number }) =>
          m.type === "photo" || (m.type === "video" && (m.width ?? 0) > 200)
      );
      if (!hasMedia) continue;

      bookmarks.push({
        id: bm.id,
        text: sanitizeText(bm.text),
        authorHandle: bm.authorHandle,
        authorName: bm.authorName,
        authorProfileImageUrl: bm.authorProfileImageUrl,
        postedAt: bm.postedAt,
        mediaObjects: bm.mediaObjects.map(
          (m: { type: string; url: string; width: number; height: number }) => ({
            type: m.type,
            url: m.url,
            width: m.width,
            height: m.height,
          })
        ),
      });
    } catch {
      // Skip malformed lines
    }
  }

  res.json({ bookmarks });
});

// POST import from twitter — download media and add to manifest
app.post("/api/import/twitter", async (req, res) => {
  const { items } = req.body as {
    items: {
      imageUrl: string;
      title: string;
      category: string;
      tags: string[];
      sourceUrl: string;
    }[];
  };

  if (!items || items.length === 0) {
    res.status(400).json({ error: "Missing items" });
    return;
  }

  const manifest = await storage.readManifest();
  const imported = [];

  for (const entry of items) {
    try {
      const response = await fetch(entry.imageUrl);
      if (!response.ok) continue;
      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get("content-type") ?? "image/jpeg";
      const ext = contentType.includes("png") ? "png" : "jpg";

      const slug = entry.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 40);
      const date = new Date().toISOString().split("T")[0];
      const filename = `${slug}-${date}.${ext}`;

      const { image: imagePath, thumb: thumbPath, lqip } = await storage.uploadImage(
        entry.category,
        filename,
        buffer,
        contentType
      );

      const id = crypto.randomUUID().slice(0, 8);
      const item = {
        id,
        title: entry.title,
        url: entry.sourceUrl,
        image: imagePath,
        thumb: thumbPath,
        lqip,
        category: entry.category as import("../src/lib/types.js").Category,
        tags: entry.tags,
        added: date,
      };
      manifest.items.unshift(item);
      imported.push(item);
    } catch (err) {
      console.error("Import failed for", entry.imageUrl, err);
    }
  }

  await storage.writeManifest(manifest);
  if (!isBlob) updateWikiTastePage(manifest);

  res.json({ imported });
});

// POST import from tweet URL — fetch via fxtwitter API
app.post("/api/tweet", async (req, res) => {
  const { url: tweetUrl, category, tags = [] } = req.body as {
    url: string;
    category: string;
    tags?: string[];
  };

  if (!tweetUrl) {
    res.status(400).json({ error: "Missing url" });
    return;
  }

  // Extract status ID from twitter/x URL
  const match = tweetUrl.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
  if (!match) {
    res.status(400).json({ error: "Invalid tweet URL" });
    return;
  }
  const statusId = match[1];

  try {
    const fxRes = await fetch(`https://api.fxtwitter.com/status/${statusId}`);
    if (!fxRes.ok) {
      res.status(502).json({ error: "Failed to fetch tweet" });
      return;
    }
    const fxData = (await fxRes.json()) as {
      tweet: {
        text: string;
        author: { screen_name: string; name: string };
        media?: {
          all: {
            type: string;
            url: string;
            thumbnail_url?: string;
            width: number;
            height: number;
          }[];
        };
      };
    };

    const tweet = fxData.tweet;
    tweet.text = sanitizeText(tweet.text);
    if (!tweet.media?.all?.length) {
      res.status(404).json({ error: "Tweet has no media" });
      return;
    }

    const manifest = await storage.readManifest();
    const imported = [];

    for (const media of tweet.media.all) {
      const hasVideo = media.type === "video" || media.type === "gif";
      const imageUrl = hasVideo ? (media.thumbnail_url ?? media.url) : media.url;
      const imageRes = await fetch(imageUrl);

      let buffer: Buffer;
      if (imageRes.ok) {
        buffer = Buffer.from(await imageRes.arrayBuffer());
      } else if (hasVideo) {
        // Thumbnail failed but video may still work — generate a dark placeholder poster
        const { default: sharpMod } = await import("sharp");
        buffer = await sharpMod({ create: { width: 640, height: 360, channels: 3, background: { r: 24, g: 24, b: 32 } } }).jpeg({ quality: 60 }).toBuffer();
      } else {
        continue;
      }
      const contentType = imageRes.headers.get("content-type") ?? "image/jpeg";
      const ext = contentType.includes("png") ? "png" : "jpg";
      const title = tweet.text
        .slice(0, 80)
        .replace(/https?:\/\/\S+/g, "")
        .trim() || `@${tweet.author.screen_name}`;
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 40);
      const date = new Date().toISOString().split("T")[0];
      const filename = `${slug}-${date}.${ext}`;
      const cat = category || "interactions";

      const { image: imagePath, thumb: thumbPath, lqip } = await storage.uploadImage(
        cat,
        filename,
        buffer,
        contentType
      );

      let videoPath: string | undefined;
      if (hasVideo) {
        const videoRes = await fetch(media.url);
        if (videoRes.ok) {
          const videoBuf = Buffer.from(await videoRes.arrayBuffer());
          const videoFilename = `${slug}-${date}.mp4`;
          if (isBlob) {
            const blobVideoPath = `taste/${cat}/${videoFilename}`;
            const { url: blobVideoUrl } = await (await import("@vercel/blob")).put(blobVideoPath, videoBuf, {
              access: "public",
              contentType: "video/mp4",
              addRandomSuffix: false,
              allowOverwrite: true,
            });
            videoPath = blobVideoUrl;
          } else {
            const localVideoPath = path.join(storage.vaultDir, cat, videoFilename);
            fs.writeFileSync(localVideoPath, videoBuf);
            videoPath = `${cat}/${videoFilename}`;
          }
        }
      }

      const id = crypto.randomUUID().slice(0, 8);
      const item = {
        id,
        title,
        url: `https://x.com/${tweet.author.screen_name}/status/${statusId}`,
        image: imagePath,
        thumb: thumbPath,
        lqip,
        ...(videoPath && { video: videoPath }),
        category: cat as import("../src/lib/types.js").Category,
        tags: tags,
        added: date,
      };
      manifest.items.unshift(item);
      imported.push(item);
    }

    await storage.writeManifest(manifest);
    if (!isBlob) updateWikiTastePage(manifest);

    res.json({ imported });
  } catch (err) {
    console.error("Tweet import failed:", err);
    res.status(500).json({ error: "Import failed" });
  }
});

// DELETE item from manifest
app.delete("/api/manifest/:id", async (req, res) => {
  const manifest = await storage.readManifest();
  const item = manifest.items.find(
    (i: { id: string }) => i.id === req.params.id
  );

  if (item) {
    await storage.deleteImage(item.image);
  }

  manifest.items = manifest.items.filter(
    (i: { id: string }) => i.id !== req.params.id
  );
  await storage.writeManifest(manifest);
  if (!isBlob) updateWikiTastePage(manifest);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Storage: ${isBlob ? "Vercel Blob" : "Local filesystem"}`);
  if (!isBlob) {
    console.log(`Vault path: ${storage.vaultDir}`);
    storage.readManifest().then(updateWikiTastePage);
  }
});
