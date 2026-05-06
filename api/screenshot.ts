import type { VercelRequest, VercelResponse } from "@vercel/node";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { isAuthorized } from "./_auth.js";
import { readManifest, writeManifest, uploadImageWithThumb } from "./_storage.js";
import type { TasteItem } from "../src/lib/types.js";

export const config = {
  maxDuration: 60,
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
    // Realistic UA so Cloudflare/anti-bot pages don't redirect to a challenge.
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );
    // Prefer networkidle2 so JS-heavy / WebGL pages have a chance to paint
    // their first frame. Fall back to domcontentloaded so slow-third-party
    // sites still resolve before maxDuration. Either way we then wait
    // 3.5s for fonts, hero images, and lazy-rendered content to settle.
    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 35000 });
    } catch {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    }
    try {
      await page.evaluate(`
        (async () => {
          if (document.fonts && document.fonts.ready) {
            await document.fonts.ready;
          }
          const imgs = Array.from(document.images || []);
          await Promise.all(
            imgs.map((img) =>
              img.complete
                ? null
                : new Promise((r) => {
                    img.addEventListener("load", r, { once: true });
                    img.addEventListener("error", r, { once: true });
                    setTimeout(r, 4000);
                  })
            )
          );
        })()
      `);
    } catch {
      // best-effort
    }
    await new Promise((r) => setTimeout(r, 3500));

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

    const hostname = new URL(url).hostname.replace(/^www\./, "");
    const title = providedTitle || meta.title || hostname;
    const slug = hostname.replace(/\./g, "-");
    const date = new Date().toISOString().split("T")[0];
    const filename = `${slug}-${date}.png`;
    const blobPath = `taste/${category}/${filename}`;

    const { imageUrl, thumbUrl, lqip } = await uploadImageWithThumb(blobPath, buffer, "image/png");

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
