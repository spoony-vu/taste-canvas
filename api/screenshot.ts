import type { VercelRequest, VercelResponse } from "@vercel/node";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import sharp from "sharp";
import { put, list } from "@vercel/blob";
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
  maxDuration: 30,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { url, title: providedTitle, category, tags } = req.body;
  if (!url || !category) {
    return res.status(400).json({ error: "Missing url or category" });
  }

  try {
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1440, height: 900 },
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await new Promise((r) => setTimeout(r, 2000));

    // Extract page metadata before screenshot
    const meta = await page.evaluate(`({
      title:
        document.querySelector('meta[property="og:title"]')?.getAttribute("content") ??
        document.title ??
        "",
      description:
        document.querySelector('meta[property="og:description"]')?.getAttribute("content") ?? "",
    })`) as { title: string; description: string };

    const screenshotBuffer = await page.screenshot({ type: "png" });
    await browser.close();

    const buffer = Buffer.from(screenshotBuffer);

    // Upload full image
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    const title = providedTitle || meta.title || hostname;
    const slug = hostname.replace(/\./g, "-");
    const date = new Date().toISOString().split("T")[0];
    const filename = `${slug}-${date}.png`;
    const blobPath = `taste/${category}/${filename}`;

    const { url: imageUrl } = await put(blobPath, buffer, {
      access: "public",
      contentType: "image/png",
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    // Generate thumbnail + LQIP
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
    const thumbPath = `taste/${category}/${slug}-${date}.thumb.webp`;
    const { url: thumbUrl } = await put(thumbPath, thumbBuf, {
      access: "public",
      contentType: "image/webp",
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    // Update manifest
    const manifest = await readManifest();
    const id = crypto.randomUUID().slice(0, 8);
    const item: TasteItem = {
      id,
      title,
      url,
      image: imageUrl,
      thumb: thumbUrl,
      lqip,
      category: category as TasteItem["category"],
      tags: tags ?? [],
      added: date,
    };
    manifest.items.unshift(item);
    await writeManifest(manifest);

    return res.json(item);
  } catch (err) {
    console.error("Screenshot failed:", err);
    return res.status(500).json({ error: String(err) });
  }
}
