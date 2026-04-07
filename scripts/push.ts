/**
 * Push local taste-canvas items to Vercel Blob.
 * Uploads all images and writes the manifest.
 *
 * Usage: BLOB_READ_WRITE_TOKEN=xxx npm run push
 * Or:    source .env.local && npm run push
 */

import fs from "node:fs";
import path from "node:path";
import { put } from "@vercel/blob";
import type { Manifest, TasteItem } from "../src/lib/types.js";

const TASTE_DIR = path.join(
  process.env.HOME ?? "~",
  "Library/Mobile Documents/com~apple~CloudDocs/obsidian-vault/spoony-vu/raw/taste"
);
const LOCAL_MANIFEST = path.join(TASTE_DIR, "manifest.json");
const MANIFEST_KEY = "taste/manifest.json";

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("Missing BLOB_READ_WRITE_TOKEN. Run: source .env.local && npm run push");
  process.exit(1);
}

async function main() {
  const manifest: Manifest = JSON.parse(fs.readFileSync(LOCAL_MANIFEST, "utf-8"));
  console.log(`Pushing ${manifest.items.length} items to Vercel Blob...`);

  const updated: TasteItem[] = [];

  for (const item of manifest.items) {
    // Skip items that already have Blob URLs
    if (item.image.startsWith("http")) {
      console.log(`  Skip (already blob): ${item.title}`);
      updated.push(item);
      continue;
    }

    const localPath = path.join(TASTE_DIR, item.image);
    if (!fs.existsSync(localPath)) {
      console.warn(`  Warning: missing file for "${item.title}": ${item.image}`);
      updated.push(item);
      continue;
    }

    const buffer = fs.readFileSync(localPath);
    const ext = path.extname(localPath).slice(1);
    const contentType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
    const blobPath = `taste/${item.image}`;

    console.log(`  Uploading: ${item.title} (${(buffer.length / 1024).toFixed(0)}KB) → ${blobPath}`);
    const { url } = await put(blobPath, buffer, {
      access: "public",
      contentType,
      addRandomSuffix: false,
    });

    updated.push({ ...item, image: url });
  }

  // Write manifest to Blob
  const blobManifest: Manifest = { items: updated };
  await put(MANIFEST_KEY, JSON.stringify(blobManifest, null, 2), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
  });

  console.log(`Done. ${updated.length} items pushed to Vercel Blob.`);
}

main().catch((err) => {
  console.error("Push failed:", err);
  process.exit(1);
});
