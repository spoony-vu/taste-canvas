/** Resolve image path — Blob URLs pass through, relative paths get /api/images/ prefix */
export function imageUrl(path: string): string {
  if (path.startsWith("http")) return path;
  return `/api/images/${path}`;
}
