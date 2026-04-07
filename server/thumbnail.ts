import sharp from "sharp";

const THUMB_WIDTH = 400;
const THUMB_QUALITY = 65;
const LQIP_WIDTH = 20;

export async function generateThumbnail(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(THUMB_WIDTH, undefined, { withoutEnlargement: true })
    .webp({ quality: THUMB_QUALITY })
    .toBuffer();
}

/** Generate a tiny base64-encoded WebP for instant placeholder */
export async function generateLqip(buffer: Buffer): Promise<string> {
  const tiny = await sharp(buffer)
    .resize(LQIP_WIDTH, undefined, { withoutEnlargement: true })
    .webp({ quality: 20 })
    .toBuffer();
  return `data:image/webp;base64,${tiny.toString("base64")}`;
}

export function thumbFilename(original: string): string {
  const base = original.replace(/\.[^.]+$/, "");
  return `${base}.thumb.webp`;
}
