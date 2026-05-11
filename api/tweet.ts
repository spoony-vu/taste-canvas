import type { VercelRequest, VercelResponse } from "@vercel/node";
import sharp from "sharp";
import { isAuthorized } from "./_auth.js";
import {
  readManifest,
  writeManifest,
  uploadBlob,
  uploadImageWithThumb,
  sanitizeText,
  slugify,
} from "./_storage.js";
import type { TasteItem } from "../src/lib/types.js";

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
      const hasVideo = media.type === "video" || media.type === "gif";
      const imageUrl = hasVideo ? (media.thumbnail_url ?? media.url) : media.url;
      const imageRes = await fetch(imageUrl);

      let buffer: Buffer;
      if (imageRes.ok) {
        buffer = Buffer.from(await imageRes.arrayBuffer());
      } else if (hasVideo) {
        // Thumbnail failed but video may still work — generate a placeholder poster
        buffer = await sharp({
          create: { width: 640, height: 360, channels: 3, background: { r: 24, g: 24, b: 32 } },
        })
          .jpeg({ quality: 60 })
          .toBuffer();
      } else {
        continue;
      }
      const contentType = imageRes.ok
        ? (imageRes.headers.get("content-type") ?? "image/jpeg")
        : "image/jpeg";
      const ext = contentType.includes("png")
        ? "png"
        : contentType.includes("webp")
          ? "webp"
          : "jpg";
      const titleText =
        tweet.text.slice(0, 80).replace(/https?:\/\/\S+/g, "").trim() ||
        `@${tweet.author.screen_name}`;
      const slug = slugify(titleText, 40);
      const date = new Date().toISOString().split("T")[0];
      const id = crypto.randomUUID().slice(0, 8);
      const filename = `${slug}-${date}-${id}.${ext}`;
      const cat = category || "interactions";
      const blobPath = `taste/${cat}/${filename}`;

      const { imageUrl: blobUrl, thumbUrl, lqip, width, height } = await uploadImageWithThumb(
        blobPath,
        buffer,
        contentType
      );

      let videoUrl: string | undefined;
      if (hasVideo) {
        const videoRes = await fetch(media.url);
        if (videoRes.ok) {
          const videoBuf = Buffer.from(await videoRes.arrayBuffer());
          const videoPath = `taste/${cat}/${slug}-${date}-${id}.mp4`;
          const { url: uploadedVideoUrl } = await uploadBlob(videoPath, videoBuf, "video/mp4");
          videoUrl = uploadedVideoUrl;
        }
      }

      const item: TasteItem = {
        id,
        title: titleText,
        url: `https://x.com/${tweet.author.screen_name}/status/${statusId}`,
        image: blobUrl,
        thumb: thumbUrl,
        lqip,
        ...(videoUrl && { video: videoUrl }),
        ...((width && height) || (media.width && media.height)
          ? { width: width ?? media.width, height: height ?? media.height }
          : {}),
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
