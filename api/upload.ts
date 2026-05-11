import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isAuthorized } from "./_auth.js";
import { readManifest, writeManifest, uploadBlob, uploadImageWithThumb, slugify } from "./_storage.js";
import type { TasteItem } from "../src/lib/types.js";

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
  if (!contentType.includes("multipart/form-data")) {
    return res.status(400).json({ error: "Expected multipart/form-data" });
  }

  // Parse multipart manually
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const body = Buffer.concat(chunks);

  const boundaryMatch = contentType.match(/boundary=(.+)/);
  if (!boundaryMatch) {
    return res.status(400).json({ error: "Missing boundary" });
  }
  const parts = parseMultipart(body, boundaryMatch[1]);

  const imagePart = parts.find((p) => p.name === "image");
  const titlePart = parts.find((p) => p.name === "title");
  const categoryPart = parts.find((p) => p.name === "category");
  const urlPart = parts.find((p) => p.name === "url");
  const tagsPart = parts.find((p) => p.name === "tags");

  const filePart = imagePart ?? parts.find((p) => p.name === "video");
  if (!filePart || !titlePart || !categoryPart) {
    return res.status(400).json({ error: "Missing file, title, or category" });
  }

  const fileBuffer = filePart.data;
  const title = titlePart.data.toString("utf-8");
  const category = categoryPart.data.toString("utf-8");
  const url = urlPart ? urlPart.data.toString("utf-8") : "";
  const tags: string[] = tagsPart ? JSON.parse(tagsPart.data.toString("utf-8")) : [];

  let ext = "png";
  let fileContentType = "image/png";
  let isVideo = false;
  if (filePart.filename) ext = filePart.filename.split(".").pop() ?? "png";
  if (filePart.contentType) {
    fileContentType = filePart.contentType;
    isVideo = filePart.contentType.startsWith("video/");
  }

  const slug = slugify(title);
  const date = new Date().toISOString().split("T")[0];
  const id = crypto.randomUUID().slice(0, 8);
  const filename = `${slug}-${date}-${id}.${ext}`;
  const blobPath = `taste/${category}/${filename}`;

  let imageUrl: string;
  let thumbUrl: string | undefined;
  let lqip: string | undefined;
  let videoUrl: string | undefined;

  if (isVideo) {
    const { url: blobUrl } = await uploadBlob(blobPath, fileBuffer, fileContentType);
    imageUrl = blobUrl;
    videoUrl = blobUrl;
  } else {
    const result = await uploadImageWithThumb(blobPath, fileBuffer, fileContentType);
    imageUrl = result.imageUrl;
    thumbUrl = result.thumbUrl;
    lqip = result.lqip;
  }

  const manifest = await readManifest();
  const item: TasteItem = {
    id,
    title,
    url,
    image: imageUrl,
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

interface MultipartPart {
  name: string;
  filename?: string;
  contentType?: string;
  data: Buffer;
}

function parseMultipart(body: Buffer, boundary: string): MultipartPart[] {
  const parts: MultipartPart[] = [];
  const sep = Buffer.from(`--${boundary}`);

  let start = indexOf(body, sep, 0);
  if (start === -1) return parts;
  start += sep.length + 2;

  while (true) {
    const end = indexOf(body, sep, start);
    if (end === -1) break;

    const partBuf = body.subarray(start, end - 2);
    const headerEnd = indexOf(partBuf, Buffer.from("\r\n\r\n"), 0);
    if (headerEnd === -1) {
      start = end + sep.length + 2;
      continue;
    }

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
    if (body[start] === 0x2d && body[start + 1] === 0x2d) break;
    start += 2;
  }

  return parts;
}

function indexOf(buf: Buffer, search: Buffer, from: number): number {
  for (let i = from; i <= buf.length - search.length; i++) {
    let found = true;
    for (let j = 0; j < search.length; j++) {
      if (buf[i + j] !== search[j]) {
        found = false;
        break;
      }
    }
    if (found) return i;
  }
  return -1;
}
