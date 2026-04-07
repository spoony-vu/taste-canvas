/** Resolve image path — Blob URLs pass through, relative paths get /api/images/ prefix */
export function imageUrl(path: string): string {
  if (path.startsWith("http")) return path;
  return `/api/images/${path}`;
}

/** Return thumb URL if available, otherwise fall back to full image */
export function thumbUrl(thumb: string | undefined, image: string): string {
  return imageUrl(thumb ?? image);
}
