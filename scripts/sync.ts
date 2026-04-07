/**
 * Sync taste-canvas items from Vercel Blob to local Obsidian vault.
 *
 * Usage: npm run sync
 *
 * Env vars:
 *   TASTE_API_URL — Base URL of the deployed app (default: https://taste-canvas.vercel.app)
 */

import fs from "node:fs";
import path from "node:path";
import type { Manifest, TasteItem } from "../src/lib/types.js";

const API_URL = process.env.TASTE_API_URL ?? "https://taste-canvas.vercel.app";

const VAULT_DIR = path.join(
  process.env.HOME ?? "~",
  "Library/Mobile Documents/com~apple~CloudDocs/obsidian-vault/spoony-vu"
);
const TASTE_DIR = path.join(VAULT_DIR, "raw/taste");
const LOCAL_MANIFEST = path.join(TASTE_DIR, "manifest.json");

function readLocalManifest(): Manifest {
  if (!fs.existsSync(LOCAL_MANIFEST)) return { items: [] };
  return JSON.parse(fs.readFileSync(LOCAL_MANIFEST, "utf-8"));
}

function writeLocalManifest(data: Manifest): void {
  fs.writeFileSync(LOCAL_MANIFEST, JSON.stringify(data, null, 2));
}

async function downloadImage(url: string, dest: string): Promise<void> {
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buffer);
}

function updateWikiTastePage(manifest: Manifest): void {
  const tastePage = path.join(VAULT_DIR, "taste-board.md");

  const grouped: Record<string, TasteItem[]> = {};
  for (const item of manifest.items) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  }

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

async function main() {
  console.log(`Fetching manifest from ${API_URL}/api/manifest...`);
  const res = await fetch(`${API_URL}/api/manifest`);
  if (!res.ok) {
    console.error(`Failed to fetch manifest: ${res.status}`);
    process.exit(1);
  }
  const remote = (await res.json()) as Manifest;
  const local = readLocalManifest();
  const localIds = new Set(local.items.map((i) => i.id));

  const newItems = remote.items.filter((i) => !localIds.has(i.id));
  console.log(
    `Remote: ${remote.items.length} items, Local: ${local.items.length} items, New: ${newItems.length}`
  );

  for (const item of newItems) {
    if (item.image.startsWith("http")) {
      // Download blob image to local vault
      const url = new URL(item.image);
      const ext = path.extname(url.pathname) || ".png";
      const slug = item.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const filename = `${slug}-${item.added}${ext}`;
      const localPath = `${item.category}/${filename}`;
      const dest = path.join(TASTE_DIR, localPath);

      console.log(`  Downloading: ${item.title} → ${localPath}`);
      await downloadImage(item.image, dest);

      // Rewrite image path to local relative
      item.image = localPath;
    } else {
      // Already a local path — check if file exists
      const dest = path.join(TASTE_DIR, item.image);
      if (!fs.existsSync(dest)) {
        console.warn(`  Warning: local image missing for "${item.title}": ${item.image}`);
      }
    }
  }

  // Merge: remote items win, but with localized image paths
  const mergedMap = new Map<string, TasteItem>();
  for (const item of local.items) mergedMap.set(item.id, item);
  for (const item of remote.items) {
    const existing = mergedMap.get(item.id);
    if (existing && !item.image.startsWith("http")) {
      // Keep existing local path
      mergedMap.set(item.id, { ...item, image: existing.image });
    } else if (!item.image.startsWith("http")) {
      mergedMap.set(item.id, item);
    } else {
      // New item with blob URL — was already localized above in newItems loop
      const localized = newItems.find((n) => n.id === item.id);
      mergedMap.set(item.id, localized ?? item);
    }
  }

  // Preserve remote ordering
  const merged: Manifest = {
    items: remote.items.map((i) => mergedMap.get(i.id)!).filter(Boolean),
  };

  writeLocalManifest(merged);
  updateWikiTastePage(merged);

  console.log(
    `Synced. Local manifest: ${merged.items.length} items. Wiki updated.`
  );
}

main().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
