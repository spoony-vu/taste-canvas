import type { VercelRequest, VercelResponse } from "@vercel/node";
import { put, list } from "@vercel/blob";
import sharp from "sharp";
import { isAuthorized } from "./_auth.js";
import type { Manifest, TasteItem } from "../src/lib/types.js";

const MANIFEST_KEY = "taste/manifest.json";

async function readManifest(): Promise<Manifest> {
  const blobs = await list({ prefix: MANIFEST_KEY });
  const match = blobs.blobs.find((b) => b.pathname === MANIFEST_KEY);
  if (!match) return { items: [] };
  const res = await fetch(match.url);
  return (await res.json()) as Manifest;
}

async function writeManifest(data: Manifest): Promise<void> {
  await put(MANIFEST_KEY, JSON.stringify(data, null, 2), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const contentType = req.headers["content-type"] ?? "";

  let fileBuffer: Buffer;
  let title: string;
  let category: string;
  let url = "";
  let tags: string[] = [];
  let ext = "png";
  let fileContentType = "image/png";
  let isVideo = false;

  if (contentType.includes("multipart/form-data")) {
    // Parse multipart manually using Web API
    const chunks: Uint8Array[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    const body = Buffer.concat(chunks);

    // Extract boundary
    const boundaryMatch = contentType.match(/boundary=(.+)/);
    if (!boundaryMatch) {
      return res.status(400).json({ error: "Missing boundary" });
    }
    const boundary = boundaryMatch[1];
    const parts = parseMultipart(body, boundary);

    const imagePart = parts.find((p) => p.name === "image");
    const titlePart = parts.find((p) => p.name === "title");
    const categoryPart = parts.find((p) => p.name === "category");
    const urlPart = parts.find((p) => p.name === "url");
    const tagsPart = parts.find((p) => p.name === "tags");

    const filePart = imagePart ?? parts.find((p) => p.name === "video");
    if (!filePart || !titlePart || !categoryPart) {
      return res.status(400).json({ error: "Missing file, title, or category" });
    }

    fileBuffer = filePart.data;
    title = titlePart.data.toString("utf-8");
    category = categoryPart.data.toString("utf-8");
    url = urlPart ? urlPart.data.toString("utf-8") : "";
    tags = tagsPart ? JSON.parse(tagsPart.data.toString("utf-8")) : [];

    if (filePart.filename) {
      ext = filePart.filename.split(".").pop() ?? "png";
    }
    if (filePart.contentType) {
      fileContentType = filePart.contentType;
      isVideo = filePart.contentType.startsWith("video/");
    }
  } else {
    return res.status(400).json({ error: "Expected multipart/form-data" });
  }

  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const date = new Date().toISOString().split("T")[0];
  const id = crypto.randomUUID().slice(0, 8);
  const filename = `${slug}-${date}-${id}.${ext}`;
  const blobPath = `taste/${category}/${filename}`;

  const { url: blobUrl } = await put(blobPath, fileBuffer, {
    access: "public",
    contentType: fileContentType,
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  let thumbUrl = "";
  let lqip = "";
  let videoUrl: string | undefined;

  if (isVideo) {
    // For video: store as-is, no thumbnail generation on server
    // The client will use the video element's poster or first frame
    videoUrl = blobUrl;
  } else {
    // Generate thumbnail + LQIP for images
    const [thumbBuf, lqipTiny] = await Promise.all([
      sharp(fileBuffer)
        .rotate()
        .resize(400, undefined, { withoutEnlargement: true })
        .webp({ quality: 65 })
        .toBuffer(),
      sharp(fileBuffer)
        .rotate()
        .resize(20, undefined, { withoutEnlargement: true })
        .webp({ quality: 20 })
        .toBuffer(),
    ]);
    lqip = `data:image/webp;base64,${lqipTiny.toString("base64")}`;
    const thumbPath = `taste/${category}/${slug}-${date}-${id}.thumb.webp`;
    ({ url: thumbUrl } = await put(thumbPath, thumbBuf, {
      access: "public",
      contentType: "image/webp",
      addRandomSuffix: false,
      allowOverwrite: true,
    }));
  }

  const manifest = await readManifest();
  const item: TasteItem = {
    id,
    title,
    url,
    image: blobUrl,
    ...(thumbUrl && { thumb: thumbUrl }),
    ...(lqip && { lqip }),
    ...(videoUrl && { video: videoUrl }),
    category: category as TasteItem["category"],
    tags,
    added: date,
  };
  manifest.items.unshift(item);
  await writeManifest(manifest);

  return res.status(201).json(item);
}

// Minimal multipart parser
interface MultipartPart {
  name: string;
  filename?: string;
  contentType?: string;
  data: Buffer;
}

function parseMultipart(body: Buffer, boundary: string): MultipartPart[] {
  const parts: MultipartPart[] = [];
  const sep = Buffer.from(`--${boundary}`);
  const bodyStr = body;

  let start = indexOf(bodyStr, sep, 0);
  if (start === -1) return parts;
  start += sep.length + 2; // skip \r\n

  while (true) {
    const end = indexOf(bodyStr, sep, start);
    if (end === -1) break;

    const partBuf = bodyStr.subarray(start, end - 2); // -2 for \r\n before boundary
    const headerEnd = indexOf(partBuf, Buffer.from("\r\n\r\n"), 0);
    if (headerEnd === -1) { start = end + sep.length + 2; continue; }

    const headerStr = partBuf.subarray(0, headerEnd).toString("utf-8");
    const data = partBuf.subarray(headerEnd + 4);

    const nameMatch = headerStr.match(/name="([^"]+)"/);
    const filenameMatch = headerStr.match(/filename="([^"]+)"/);
    const ctMatch = headerStr.match(/Content-Type:\s*(.+)/i);

    if (nameMatch) {
      parts.push({
        name: nameMatch[1],
        filename: filenameMatch?.[1],
        contentType: ctMatch?.[1]?.trim(),
        data,
      });
    }

    start = end + sep.length;
    // Check for -- (end marker)
    if (bodyStr[start] === 0x2d && bodyStr[start + 1] === 0x2d) break;
    start += 2; // skip \r\n
  }

  return parts;
}

function indexOf(buf: Buffer, search: Buffer, from: number): number {
  for (let i = from; i <= buf.length - search.length; i++) {
    let found = true;
    for (let j = 0; j < search.length; j++) {
      if (buf[i + j] !== search[j]) { found = false; break; }
    }
    if (found) return i;
  }
  return -1;
}
