import type { ApiRequest, ApiResponse } from "./_types.js";
import { errorPayload, statusForError } from "./_errors.js";
import { fetchPublicUrlText } from "./_url.js";

const META_TIMEOUT_MS = 5_000;
const META_MAX_BYTES = 64 * 1024;
const HTML_CONTENT_TYPES = [/^text\/html\b/i, /^application\/xhtml\+xml\b/i, /^$/];

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const url = req.query.url as string | undefined;
  if (!url) {
    return res.status(400).json({ error: "Missing url parameter" });
  }

  try {
    const head = await fetchPublicUrlText(url, {
      timeoutMs: META_TIMEOUT_MS,
      maxBytes: META_MAX_BYTES,
      accept: "text/html,application/xhtml+xml",
      allowedContentTypes: HTML_CONTENT_TYPES,
    });

    const ogTitle = head.match(
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
    )?.[1];
    const ogDescription = head.match(
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i
    )?.[1];
    const ogImage = head.match(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
    )?.[1];
    const htmlTitle = head.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];

    const title = decodeEntities(ogTitle ?? htmlTitle ?? "");
    const description = decodeEntities(ogDescription ?? "");
    const image = ogImage ? decodeEntities(ogImage) : "";

    return res.json({ title, description, image });
  } catch (err) {
    return res.status(statusForError(err, 502)).json(errorPayload(err));
  }
}

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}
