import fs from "node:fs";
import path from "node:path";
import { put, del, list } from "@vercel/blob";
import type { Manifest } from "../src/lib/types.js";
import { generateThumbnail, generateLqip, thumbFilename } from "./thumbnail.js";

const VAULT_TASTE_DIR = path.join(
  process.env.HOME ?? "~",
  "Library/Mobile Documents/com~apple~CloudDocs/obsidian-vault/spoony-vu/raw/taste"
);
const MANIFEST_PATH = path.join(VAULT_TASTE_DIR, "manifest.json");

export const isBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

// --- Local filesystem storage ---

function localReadManifest(): Manifest {
  if (!fs.existsSync(MANIFEST_PATH)) {
    const seed: Manifest = { items: [] };
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(seed, null, 2));
    return seed;
  }
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
}

function localWriteManifest(data: Manifest): void {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(data, null, 2));
}

function localUploadImage(
  category: string,
  filename: string,
  buffer: Buffer
): string {
  const outputPath = path.join(VAULT_TASTE_DIR, category, filename);
  fs.writeFileSync(outputPath, buffer);
  return `${category}/${filename}`;
}

function localGetImagePath(imagePath: string): string | null {
  const full = path.join(VAULT_TASTE_DIR, imagePath);
  return fs.existsSync(full) ? full : null;
}

// --- Vercel Blob storage ---

const MANIFEST_BLOB_KEY = "taste/manifest.json";

async function blobReadManifest(): Promise<Manifest> {
  const blobs = await list({ prefix: MANIFEST_BLOB_KEY });
  const match = blobs.blobs.find((b) => b.pathname === MANIFEST_BLOB_KEY);
  if (!match) return { items: [] };
  const res = await fetch(match.url);
  return (await res.json()) as Manifest;
}

async function blobWriteManifest(data: Manifest): Promise<void> {
  await put(MANIFEST_BLOB_KEY, JSON.stringify(data, null, 2), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

async function blobUploadImage(
  category: string,
  filename: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const blobPath = `taste/${category}/${filename}`;
  const { url } = await put(blobPath, buffer, {
    access: "public",
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return url;
}

async function blobDeleteImage(imageUrl: string): Promise<void> {
  if (imageUrl.startsWith("http")) {
    await del(imageUrl);
  }
}

// --- Unified interface ---

export const storage = {
  async readManifest(): Promise<Manifest> {
    return isBlob ? blobReadManifest() : localReadManifest();
  },

  async writeManifest(data: Manifest): Promise<void> {
    if (isBlob) {
      await blobWriteManifest(data);
    } else {
      localWriteManifest(data);
    }
  },

  async uploadImage(
    category: string,
    filename: string,
    buffer: Buffer,
    contentType = "image/png"
  ): Promise<{ image: string; thumb: string; lqip: string }> {
    const [thumbBuf, lqip] = await Promise.all([
      generateThumbnail(buffer),
      generateLqip(buffer),
    ]);
    const thumbName = thumbFilename(filename);

    if (isBlob) {
      const image = await blobUploadImage(category, filename, buffer, contentType);
      const thumb = await blobUploadImage(category, thumbName, thumbBuf, "image/webp");
      return { image, thumb, lqip };
    }
    const image = localUploadImage(category, filename, buffer);
    const thumb = localUploadImage(category, thumbName, thumbBuf);
    return { image, thumb, lqip };
  },

  async deleteImage(imagePath: string): Promise<void> {
    if (isBlob) {
      await blobDeleteImage(imagePath);
    } else {
      const full = path.join(VAULT_TASTE_DIR, imagePath);
      if (fs.existsSync(full)) fs.unlinkSync(full);
    }
  },

  getLocalImagePath: localGetImagePath,

  get vaultDir() {
    return VAULT_TASTE_DIR;
  },
};
