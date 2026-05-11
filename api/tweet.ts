import type { ApiRequest, ApiResponse } from "./_types.js";
import sharp from "sharp";
import { isAuthorized } from "./_auth.js";
import { errorPayload, HttpError, statusForError } from "./_errors.js";
import { normalizeCategory, normalizeTags } from "./_input.js";
import { deleteUnreferencedAssets, prependItems } from "./_manifest.js";
import { fetchPublicUrlBuffer, fetchPublicUrlText, parsePublicHttpUrl } from "./_url.js";
import {
  uploadBlob,
  uploadImageWithThumb,
  sanitizeText,
  slugify,
} from "./_storage.js";
import type { TasteItem } from "../src/lib/types.js";

const TWEET_TIMEOUT_MS = 7_000;
const TWEET_JSON_MAX_BYTES = 256 * 1024;
const TWEET_IMAGE_MAX_BYTES = 6 * 1024 * 1024;
const TWEET_VIDEO_MAX_BYTES = 12 * 1024 * 1024;
const IMAGE_CONTENT_TYPES = [/^image\/(jpeg|png|webp|gif)\b/i];
const VIDEO_CONTENT_TYPES = [/^video\/(mp4|webm|quicktime)\b/i, /^application\/octet-stream\b/i];

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { url: tweetUrl, category, tags } = req.body as {
    url?: unknown;
    category?: unknown;
    tags?: unknown;
  };

  if (typeof tweetUrl !== "string" || !tweetUrl) {
    return res.status(400).json({ error: "Missing url" });
  }

  const status = parseTweetStatus(tweetUrl);
  if (!status) {
    return res.status(400).json({ error: "Invalid tweet URL" });
  }
  const { statusId, authorHandle } = status;
  const normalizedCategory = normalizeCategory(category, "interactions");
  const normalizedTags = normalizeTags(tags);
  const imported: TasteItem[] = [];

  try {
    const fxText = await fetchPublicUrlText(`https://api.fxtwitter.com/status/${statusId}`, {
      timeoutMs: TWEET_TIMEOUT_MS,
      maxBytes: TWEET_JSON_MAX_BYTES,
      accept: "application/json",
      allowedContentTypes: [/^application\/json\b/i, /^text\/json\b/i, /^$/],
    });
    const fxData = JSON.parse(fxText) as {
      tweet: {
        text: string;
        author: { screen_name: string; name: string };
        media?: {
          all: {
            type: string;
            url: string;
            thumbnail_url?: string;
            width: number;
            height: number;
          }[];
        };
      };
    };

    const tweet = fxData.tweet;
    tweet.text = sanitizeText(tweet.text);
    if (!tweet.media?.all?.length) {
      return res.status(404).json({ error: "Tweet has no media" });
    }

    for (const media of tweet.media.all) {
      const hasVideo = media.type === "video" || media.type === "gif";
      const imageUrl = hasVideo ? (media.thumbnail_url ?? media.url) : media.url;

      let buffer: Buffer;
      let contentType = "image/jpeg";
      try {
        const image = await fetchPublicUrlBuffer(imageUrl, {
          timeoutMs: TWEET_TIMEOUT_MS,
          maxBytes: TWEET_IMAGE_MAX_BYTES,
          accept: "image/*",
          allowedContentTypes: IMAGE_CONTENT_TYPES,
        });
        buffer = image.buffer;
        contentType = image.contentType || contentType;
      } catch (error) {
        if (!hasVideo) throw error;
        // Thumbnail failed but video may still work — generate a placeholder poster
        buffer = await sharp({
          create: { width: 640, height: 360, channels: 3, background: { r: 24, g: 24, b: 32 } },
        })
          .jpeg({ quality: 60 })
          .toBuffer();
      }

      const ext = contentType.includes("png")
        ? "png"
        : contentType.includes("webp")
          ? "webp"
          : "jpg";
      const titleText =
        tweet.text.slice(0, 80).replace(/https?:\/\/\S+/g, "").trim() ||
        `@${tweet.author.screen_name}`;
      const slug = slugify(titleText, 40) || "tweet";
      const date = new Date().toISOString().split("T")[0];
      const id = crypto.randomUUID().slice(0, 8);
      const filename = `${slug}-${date}-${id}.${ext}`;
      const cat = normalizedCategory;
      const blobPath = `taste/${cat}/${filename}`;

      const { imageUrl: blobUrl, thumbUrl, lqip, width, height } = await uploadImageWithThumb(
        blobPath,
        buffer,
        contentType
      );

      let videoUrl: string | undefined;
      if (hasVideo) {
        try {
          const video = await fetchPublicUrlBuffer(media.url, {
            timeoutMs: TWEET_TIMEOUT_MS,
            maxBytes: TWEET_VIDEO_MAX_BYTES,
            accept: "video/*",
            allowedContentTypes: VIDEO_CONTENT_TYPES,
          });
          const videoPath = `taste/${cat}/${slug}-${date}-${id}.mp4`;
          const { url: uploadedVideoUrl } = await uploadBlob(videoPath, video.buffer, "video/mp4");
          videoUrl = uploadedVideoUrl;
        } catch {
          // Keep the imported poster even if the original video is too large or unavailable.
        }
      }

      const item: TasteItem = {
        id,
        title: titleText,
        url: `https://x.com/${tweet.author.screen_name || authorHandle}/status/${statusId}`,
        image: blobUrl,
        thumb: thumbUrl,
        lqip,
        ...(videoUrl && { video: videoUrl }),
        ...((width && height) || (media.width && media.height)
          ? { width: width ?? media.width, height: height ?? media.height }
          : {}),
        category: cat as TasteItem["category"],
        tags: normalizedTags,
        added: date,
      };
      imported.push(item);
    }

    if (!imported.length) {
      throw new HttpError(404, "No supported tweet media found", "tweet_media_not_found");
    }
    await prependItems(imported);
    return res.status(201).json({ imported });
  } catch (err) {
    console.error("Tweet import failed:", err);
    await Promise.all(imported.map((item) => deleteUnreferencedAssets(item, { items: [] }).catch(() => {})));
    return res.status(statusForError(err)).json(errorPayload(err));
  }
}

function parseTweetStatus(raw: string): { statusId: string; authorHandle: string } | null {
  let url: URL;
  try {
    url = parsePublicHttpUrl(raw);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host !== "twitter.com" && host !== "x.com") return null;
  const match = url.pathname.match(/^\/([^/]+)\/status\/(\d+)\/?$/);
  if (!match) return null;
  return { authorHandle: match[1], statusId: match[2] };
}
