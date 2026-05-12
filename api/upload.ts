import type { ApiRequest, ApiResponse } from "./_types.js";
import sharp from "sharp";
import { isAuthorized } from "./_auth.js";
import { errorPayload, HttpError, statusForError } from "./_errors.js";
import { normalizeCategory, parseTagsJson } from "./_input.js";
import { deleteUnreferencedAssets, prependItems } from "./_manifest.js";
import { uploadBlob, uploadImageWithThumb, slugify } from "./_storage.js";
import type { TasteItem } from "../src/lib/types.js";

export const config = {
  api: { bodyParser: false },
};

const MAX_MULTIPART_BYTES = 4_500_000;
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

export default async function handler(req: ApiRequest, res: ApiResponse) {
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

  let item: TasteItem | null = null;

  try {
    const body = await readRequestBody(req, MAX_MULTIPART_BYTES);
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
    if (fileBuffer.byteLength > MAX_FILE_BYTES) {
      throw new HttpError(413, "Uploaded file is too large", "upload_too_large");
    }

    const title = titlePart.data.toString("utf-8").trim();
    const category = normalizeCategory(categoryPart.data.toString("utf-8"));
    const url = urlPart ? urlPart.data.toString("utf-8") : "";
    const tags = parseTagsJson(tagsPart?.data);
    if (!title) {
      return res.status(400).json({ error: "Missing title" });
    }

    const fileContentType = filePart.contentType ?? "image/png";
    const isVideo = fileContentType.startsWith("video/");
    validateUploadContentType(fileContentType, isVideo);

    const ext = extensionForUpload(filePart.filename, fileContentType);
    const slug = slugify(title) || "upload";
    const date = new Date().toISOString().split("T")[0];
    const id = crypto.randomUUID().slice(0, 8);
    const filename = `${slug}-${date}-${id}.${ext}`;
    const blobPath = `taste/${category}/${filename}`;

    let imageUrl: string;
    let thumbUrl: string | undefined;
    let lqip: string | undefined;
    let videoUrl: string | undefined;
    let width: number | undefined;
    let height: number | undefined;

    if (isVideo) {
      const { url: blobUrl } = await uploadBlob(blobPath, fileBuffer, fileContentType);
      videoUrl = blobUrl;
      const posterBuffer = await sharp({
        create: {
          width: 1280,
          height: 720,
          channels: 3,
          background: { r: 25, g: 25, b: 31 },
        },
      })
        .jpeg({ quality: 70 })
        .toBuffer();
      const posterPath = blobPath.replace(/\.[^.]+$/, "") + ".poster.jpg";
      const poster = await uploadImageWithThumb(posterPath, posterBuffer, "image/jpeg");
      imageUrl = poster.imageUrl;
      thumbUrl = poster.thumbUrl;
      lqip = poster.lqip;
      width = poster.width;
      height = poster.height;
    } else {
      const result = await uploadImageWithThumb(blobPath, fileBuffer, fileContentType);
      imageUrl = result.imageUrl;
      thumbUrl = result.thumbUrl;
      lqip = result.lqip;
      width = result.width;
      height = result.height;
    }

    item = {
      id,
      title,
      url,
      image: imageUrl,
      ...(thumbUrl && { thumb: thumbUrl }),
      ...(lqip && { lqip }),
      ...(videoUrl && { video: videoUrl }),
      ...(width && height && { width, height }),
      category: category as TasteItem["category"],
      tags,
      added: date,
    };
    await prependItems([item]);

    return res.status(201).json(item);
  } catch (error) {
    if (item) await deleteUnreferencedAssets(item, { items: [] }).catch(() => {});
    return res.status(statusForError(error)).json(errorPayload(error));
  }
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

async function readRequestBody(req: ApiRequest, maxBytes: number): Promise<Buffer> {
  const contentLength = Number(req.headers["content-length"] ?? 0);
  if (contentLength > maxBytes) {
    throw new HttpError(413, "Multipart body is too large", "multipart_too_large");
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    total += buffer.byteLength;
    if (total > maxBytes) {
      throw new HttpError(413, "Multipart body is too large", "multipart_too_large");
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks, total);
}

function validateUploadContentType(contentType: string, isVideo: boolean): void {
  const allowed = isVideo ? ALLOWED_VIDEO_TYPES : ALLOWED_IMAGE_TYPES;
  if (!allowed.has(contentType)) {
    throw new HttpError(415, "Unsupported upload content type", "unsupported_upload_type");
  }
}

function extensionForUpload(filename: string | undefined, contentType: string): string {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/gif") return "gif";
  if (contentType === "video/mp4") return "mp4";
  if (contentType === "video/webm") return "webm";
  if (contentType === "video/quicktime") return "mov";
  return filename?.split(".").pop() ?? "bin";
}
