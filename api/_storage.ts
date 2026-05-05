import { put, list, del } from "@vercel/blob";
import sharp from "sharp";
import type { Manifest } from "../src/lib/types.js";

export const MANIFEST_KEY = "taste/manifest.json";

export async function readManifest(): Promise<Manifest> {
  const blobs = await list({ prefix: MANIFEST_KEY });
  const match = blobs.blobs.find((b) => b.pathname === MANIFEST_KEY);
  if (!match) return { items: [] };
  const res = await fetch(match.url);
  return (await res.json()) as Manifest;
}

export async function writeManifest(data: Manifest): Promise<void> {
  await put(MANIFEST_KEY, JSON.stringify(data, null, 2), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

export async function deleteBlob(url: string): Promise<void> {
  try {
    await del(url);
  } catch {
    // already deleted or transient — ignore
  }
}

/** Strip lone Unicode surrogates that break JSON serialization. */
export function sanitizeText(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "\uFFFD");
}

export interface UploadResult {
  imageUrl: string;
  thumbUrl?: string;
  lqip?: string;
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
  const { url: imageUrl } = await put(blobPath, buffer, {
    access: "public",
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  const [thumbBuf, lqipTiny] = await Promise.all([
    sharp(buffer).rotate().resize(400, undefined, { withoutEnlargement: true }).webp({ quality: 65 }).toBuffer(),
    sharp(buffer).rotate().resize(20, undefined, { withoutEnlargement: true }).webp({ quality: 20 }).toBuffer(),
  ]);
  const lqip = `data:image/webp;base64,${lqipTiny.toString("base64")}`;

  // Derive thumb path: strip extension, append .thumb.webp
  const thumbPath = blobPath.replace(/\.[^.]+$/, "") + ".thumb.webp";
  const { url: thumbUrl } = await put(thumbPath, thumbBuf, {
    access: "public",
    contentType: "image/webp",
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  return { imageUrl, thumbUrl, lqip };
}

/** Slugify a string for use in blob paths. */
export function slugify(s: string, maxLen = 60): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, maxLen);
}
