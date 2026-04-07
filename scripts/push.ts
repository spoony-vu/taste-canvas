/**
 * Push local taste-canvas items to Vercel Blob.
 * Uploads all images + generates WebP thumbnails, writes manifest.
 *
 * Usage: source .env.local && npm run push
 */

import fs from "node:fs";
import path from "node:path";
import { put } from "@vercel/blob";
import sharp from "sharp";
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

async function generateThumb(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(600, undefined, { withoutEnlargement: true })
    .webp({ quality: 75 })
    .toBuffer();
}

async function main() {
  const manifest: Manifest = JSON.parse(fs.readFileSync(LOCAL_MANIFEST, "utf-8"));
  console.log(`Pushing ${manifest.items.length} items to Vercel Blob...`);

  const updated: TasteItem[] = [];

  for (const item of manifest.items) {
    // Skip items that already have Blob URLs with thumbs
    if (item.image.startsWith("http") && item.thumb) {
      console.log(`  Skip (done): ${item.title}`);
      updated.push(item);
      continue;
    }

    // Determine source buffer
    let buffer: Buffer;
    let blobImageUrl: string;

    if (item.image.startsWith("http")) {
      // Already uploaded but needs thumb — download it
      console.log(`  Generating thumb: ${item.title}`);
      const res = await fetch(item.image);
      buffer = Buffer.from(await res.arrayBuffer());
      blobImageUrl = item.image;
    } else {
      // Local file — upload full image
      const localPath = path.join(TASTE_DIR, item.image);
      if (!fs.existsSync(localPath)) {
        console.warn(`  Warning: missing file for "${item.title}": ${item.image}`);
        updated.push(item);
        continue;
      }
      buffer = fs.readFileSync(localPath);
      const ext = path.extname(localPath).slice(1);
      const contentType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
      const blobPath = `taste/${item.image}`;

      console.log(`  Uploading: ${item.title} (${(buffer.length / 1024).toFixed(0)}KB)`);
      const { url } = await put(blobPath, buffer, {
        access: "public",
        contentType,
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      blobImageUrl = url;
    }

    // Generate and upload thumbnail
    const thumbBuf = await generateThumb(buffer);
    const thumbName = item.image.startsWith("http")
      ? item.image.replace(/\.[^.]+$/, ".thumb.webp").split("/").pop()!
      : item.image.replace(/\.[^.]+$/, ".thumb.webp");
    const thumbBlobPath = item.image.startsWith("http")
      ? `taste/${thumbName}`
      : `taste/${thumbName}`;

    const { url: thumbUrl } = await put(thumbBlobPath, thumbBuf, {
      access: "public",
      contentType: "image/webp",
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    console.log(`    Thumb: ${(thumbBuf.length / 1024).toFixed(0)}KB`);
    updated.push({ ...item, image: blobImageUrl, thumb: thumbUrl });
  }

  const blobManifest: Manifest = { items: updated };
  await put(MANIFEST_KEY, JSON.stringify(blobManifest, null, 2), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  console.log(`Done. ${updated.length} items pushed with thumbnails.`);
}

main().catch((err) => {
  console.error("Push failed:", err);
  process.exit(1);
});
