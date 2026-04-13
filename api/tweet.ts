import type { VercelRequest, VercelResponse } from "@vercel/node";
import { put, list } from "@vercel/blob";
import sharp from "sharp";
import { isAuthorized } from "./_auth.js";
import type { Manifest, TasteItem } from "../src/lib/types.js";

const MANIFEST_KEY = "taste/manifest.json";

/** Strip lone Unicode surrogates that break JSON serialization */
function sanitizeText(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "\uFFFD");
}

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { url: tweetUrl, category, tags = [] } = req.body as {
    url: string;
    category: string;
    tags?: string[];
  };

  if (!tweetUrl) {
    return res.status(400).json({ error: "Missing url" });
  }

  const match = tweetUrl.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
  if (!match) {
    return res.status(400).json({ error: "Invalid tweet URL" });
  }
  const statusId = match[1];

  try {
    const fxRes = await fetch(`https://api.fxtwitter.com/status/${statusId}`);
    if (!fxRes.ok) {
      return res.status(502).json({ error: "Failed to fetch tweet" });
    }
    const fxData = (await fxRes.json()) as {
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

    const manifest = await readManifest();
    const imported: TasteItem[] = [];

    for (const media of tweet.media.all) {
      const imageUrl = media.type === "video" ? (media.thumbnail_url ?? media.url) : media.url;
      const imageRes = await fetch(imageUrl);
      if (!imageRes.ok) continue;

      const buffer = Buffer.from(await imageRes.arrayBuffer());
      const contentType = imageRes.headers.get("content-type") ?? "image/jpeg";
      const ext = contentType.includes("png") ? "png" : "jpg";
      const title = tweet.text
        .slice(0, 80)
        .replace(/https?:\/\/\S+/g, "")
        .trim() || `@${tweet.author.screen_name}`;
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 40);
      const date = new Date().toISOString().split("T")[0];
      const filename = `${slug}-${date}.${ext}`;
      const cat = category || "interactions";
      const blobPath = `taste/${cat}/${filename}`;

      const { url: blobUrl } = await put(blobPath, buffer, {
        access: "public",
        contentType,
        addRandomSuffix: false,
        allowOverwrite: true,
      });

      const [thumbBuf, lqipTiny] = await Promise.all([
        sharp(buffer)
          .resize(400, undefined, { withoutEnlargement: true })
          .webp({ quality: 65 })
          .toBuffer(),
        sharp(buffer)
          .resize(20, undefined, { withoutEnlargement: true })
          .webp({ quality: 20 })
          .toBuffer(),
      ]);
      const lqip = `data:image/webp;base64,${lqipTiny.toString("base64")}`;
      const thumbPath = `taste/${cat}/${slug}-${date}.thumb.webp`;
      const { url: thumbUrl } = await put(thumbPath, thumbBuf, {
        access: "public",
        contentType: "image/webp",
        addRandomSuffix: false,
        allowOverwrite: true,
      });

      let videoUrl: string | undefined;
      if (media.type === "video") {
        const videoRes = await fetch(media.url);
        if (videoRes.ok) {
          const videoBuf = Buffer.from(await videoRes.arrayBuffer());
          const videoPath = `taste/${cat}/${slug}-${date}.mp4`;
          const { url: uploadedVideoUrl } = await put(videoPath, videoBuf, {
            access: "public",
            contentType: "video/mp4",
            addRandomSuffix: false,
            allowOverwrite: true,
          });
          videoUrl = uploadedVideoUrl;
        }
      }

      const id = crypto.randomUUID().slice(0, 8);
      const item: TasteItem = {
        id,
        title,
        url: `https://x.com/${tweet.author.screen_name}/status/${statusId}`,
        image: blobUrl,
        thumb: thumbUrl,
        lqip,
        ...(videoUrl && { video: videoUrl }),
        category: cat as TasteItem["category"],
        tags,
        added: date,
      };
      manifest.items.unshift(item);
      imported.push(item);
    }

    await writeManifest(manifest);
    return res.status(201).json({ imported });
  } catch (err) {
    console.error("Tweet import failed:", err);
    return res.status(500).json({ error: "Import failed" });
  }
}
