import sharp from "sharp";

const THUMB_WIDTH = 600;
const THUMB_QUALITY = 75;

export async function generateThumbnail(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(THUMB_WIDTH, undefined, { withoutEnlargement: true })
    .webp({ quality: THUMB_QUALITY })
    .toBuffer();
}

export function thumbFilename(original: string): string {
  const base = original.replace(/\.[^.]+$/, "");
  return `${base}.thumb.webp`;
}
