import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { captureScreenshot } from "./screenshot.js";
import { storage, isBlob } from "./storage.js";

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

// POST screenshot — capture URL, save to vault, add to manifest (local only)
app.post("/api/screenshot", async (req, res) => {
  if (isBlob) {
    res.status(501).json({ error: "Use /api/upload on Vercel — Playwright not available" });
    return;
  }

  const { url, title, category, tags } = req.body;

  if (!url || !title || !category) {
    res.status(400).json({ error: "Missing url, title, or category" });
    return;
  }

  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    const slug = hostname.replace(/\./g, "-");
    const date = new Date().toISOString().split("T")[0];
    const filename = `${slug}-${date}.png`;
    const outputPath = path.join(storage.vaultDir, category, filename);

    await captureScreenshot(url, outputPath);

    const manifest = await storage.readManifest();
    const id = crypto.randomUUID().slice(0, 8);
    const item = {
      id,
      title,
      url,
      image: `${category}/${filename}`,
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

  const imagePath = await storage.uploadImage(
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
