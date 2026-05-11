import { put, list, del } from "@vercel/blob";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import type { Manifest } from "../src/lib/types.js";

export const MANIFEST_KEY = "taste/manifest.json";
const LOCAL_ROOT = fileURLToPath(new URL("../.taste-canvas-local", import.meta.url));
const LOCAL_BLOB_ROOT = join(LOCAL_ROOT, "blobs");
const LOCAL_MANIFEST_PATH = join(LOCAL_ROOT, "manifest.json");

function isLocalStorageEnabled(): boolean {
  return !process.env.BLOB_READ_WRITE_TOKEN && process.env.VERCEL !== "1";
}

function normalizeBlobPath(blobPath: string): string {
  return blobPath
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .map((part) => part.replace(/[^a-zA-Z0-9._-]/g, "-"))
    .join("/");
}

function localBlobUrl(blobPath: string): string {
  return `/local-blob/${normalizeBlobPath(blobPath)
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

export async function readManifest(): Promise<Manifest> {
  if (isLocalStorageEnabled()) {
    try {
      return JSON.parse(await readFile(LOCAL_MANIFEST_PATH, "utf-8")) as Manifest;
    } catch {
      return { items: [] };
    }
  }

  const blobs = await list({ prefix: MANIFEST_KEY });
  const match = blobs.blobs.find((b) => b.pathname === MANIFEST_KEY);
  if (!match) return { items: [] };
  const res = await fetch(match.url, { cache: "no-store" });
  return (await res.json()) as Manifest;
}

export async function writeManifest(data: Manifest): Promise<void> {
  if (isLocalStorageEnabled()) {
    await mkdir(dirname(LOCAL_MANIFEST_PATH), { recursive: true });
    await writeFile(LOCAL_MANIFEST_PATH, JSON.stringify(data, null, 2));
    return;
  }

  await put(MANIFEST_KEY, JSON.stringify(data, null, 2), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
  });
}

export async function uploadBlob(
  blobPath: string,
  buffer: Buffer,
  contentType: string
): Promise<{ url: string }> {
  if (isLocalStorageEnabled()) {
    const localPath = join(LOCAL_BLOB_ROOT, normalizeBlobPath(blobPath));
    await mkdir(dirname(localPath), { recursive: true });
    await writeFile(localPath, buffer, { flag: "wx" });
    return { url: localBlobUrl(blobPath) };
  }

  return put(blobPath, buffer, {
    access: "public",
    contentType,
    addRandomSuffix: false,
    allowOverwrite: false,
    cacheControlMaxAge: 31536000,
  });
}

export async function deleteBlob(url: string): Promise<void> {
  if (url.startsWith("/local-blob/")) {
    const pathname = decodeURIComponent(url.replace(/^\/local-blob\//, ""));
    await rm(join(LOCAL_BLOB_ROOT, normalizeBlobPath(pathname)), { force: true });
    return;
  }

  try {
    await del(url);
  } catch {
    // already deleted or transient — ignore
  }
}

/** Strip lone Unicode surrogates that break JSON serialization. */
export function sanitizeText(s: string): string {
  return s.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "\uFFFD");
}

export interface UploadResult {
  imageUrl: string;
  thumbUrl?: string;
  lqip?: string;
  width?: number;
  height?: number;
}

function normalizeDimensions(meta: sharp.Metadata): { width?: number; height?: number } {
  if (!meta.width || !meta.height) return {};
  const rotated =
    typeof meta.orientation === "number" &&
    meta.orientation >= 5 &&
    meta.orientation <= 8;
  return rotated
    ? { width: meta.height, height: meta.width }
    : { width: meta.width, height: meta.height };
}

/**
 * Upload an image buffer to Vercel Blob and generate a WebP thumbnail + LQIP.
 * Returns the canonical URLs and base64 LQIP data URL.
 */
export async function uploadImageWithThumb(
  blobPath: string,
  buffer: Buffer,
  contentType: string
): Promise<UploadResult> {
  const { url: imageUrl } = await uploadBlob(blobPath, buffer, contentType);

  const [metadata, thumbBuf, lqipTiny] = await Promise.all([
    sharp(buffer).metadata(),
    sharp(buffer).rotate().resize(400, undefined, { withoutEnlargement: true }).webp({ quality: 65 }).toBuffer(),
    sharp(buffer).rotate().resize(20, undefined, { withoutEnlargement: true }).webp({ quality: 20 }).toBuffer(),
  ]);
  const lqip = `data:image/webp;base64,${lqipTiny.toString("base64")}`;

  // Derive thumb path: strip extension, append .thumb.webp
  const thumbPath = blobPath.replace(/\.[^.]+$/, "") + ".thumb.webp";
  const { url: thumbUrl } = await uploadBlob(thumbPath, thumbBuf, "image/webp");

  return { imageUrl, thumbUrl, lqip, ...normalizeDimensions(metadata) };
}

/** Slugify a string for use in blob paths. */
export function slugify(s: string, maxLen = 60): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, maxLen);
}
