const absoluteImageSource = /^(https?:|data:image\/|blob:)/i;

/** Resolve image path — absolute image sources pass through, relative paths get /api/images/ prefix */
export function imageUrl(path: string): string {
  if (absoluteImageSource.test(path) || path.startsWith("/")) return path;
  return `/api/images/${path}`;
}

/** Return thumb URL if available, otherwise fall back to full image */
export function thumbUrl(thumb: string | undefined, image: string): string {
  return imageUrl(thumb ?? image);
}
