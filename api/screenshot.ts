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

    // Single navigation. networkidle2 NEVER resolves on landing pages with
    // analytics/websockets/marquees, so don't wait for it — domcontentloaded
    // is the only reliable signal. We never re-navigate; whatever paints
    // before our gates trip is what we shoot.
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });

    // Race the `load` event with an 8s cap so SPAs that emit load late
    // still proceed.
    await Promise.race([
      page.evaluate(
        `new Promise((r) => { if (document.readyState === "complete") r(); else window.addEventListener("load", r, { once: true }); })`
      ),
      new Promise((r) => setTimeout(r, 8000)),
    ]).catch(() => {});

    try {
      await page.evaluate(`
        (async () => {
          // Fonts ready — fast on most sites.
          if (document.fonts && document.fonts.ready) {
            try { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 4000))]); } catch {}
          }

          // Best-effort cookie/consent dismiss so banners don't dominate the hero.
          try {
            const sel = [
              "#onetrust-accept-btn-handler",
              "button#onetrust-accept-btn-handler",
              "[aria-label='Accept all']",
              "[aria-label='Accept all cookies']",
              "[aria-label*='accept' i]",
              "button[id*='accept' i]",
              "button[class*='accept' i]",
              "[data-testid*='accept' i]",
            ];
            for (const s of sel) {
              const el = document.querySelector(s);
              if (el && typeof el.click === "function") { el.click(); break; }
            }
          } catch {}

          // Wait only for ABOVE-FOLD images (visible in viewport) — skip
          // lazy-loaded below-fold images that won't load without scroll.
          const vh = window.innerHeight, vw = window.innerWidth;
          const aboveFold = Array.from(document.images || []).filter((img) => {
            try {
              const r = img.getBoundingClientRect();
              return r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw && r.width > 16 && r.height > 16;
            } catch { return false; }
          });
          const perImage = (img) => img.complete
            ? Promise.resolve()
            : new Promise((r) => {
                img.addEventListener("load", r, { once: true });
                img.addEventListener("error", r, { once: true });
                setTimeout(r, 2500);
              });
          await Promise.race([
            Promise.all(aboveFold.map(perImage)),
            new Promise((r) => setTimeout(r, 5000)),
          ]);

          // Non-white pixel poll: confirm SOMETHING has painted before we
          // shoot. If a large hero <img>/<video> in the viewport already
          // loaded, skip the poll. Otherwise sample a 1px canvas at the
          // viewport center every 200ms for up to 3s.
          const heroLoaded = aboveFold.some((img) => {
            const r = img.getBoundingClientRect();
            return r.width > 200 && r.top < vh * 0.6 && img.complete && img.naturalWidth > 0;
          });
          if (!heroLoaded) {
            const start = Date.now();
            while (Date.now() - start < 3000) {
              try {
                const el = document.elementFromPoint(vw / 2, vh / 2);
                if (el && el !== document.body && el !== document.documentElement) {
                  const cs = getComputedStyle(el);
                  // Anything with non-default text or non-white background is real content.
                  if (cs.backgroundImage !== "none" || (cs.backgroundColor && !/rgba?\\(\\s*0\\s*,\\s*0\\s*,\\s*0\\s*,\\s*0\\s*\\)|rgb\\(255,\\s*255,\\s*255\\)/.test(cs.backgroundColor))) break;
                  if ((el.textContent || "").trim().length > 4) break;
                }
              } catch {}
              await new Promise((r) => setTimeout(r, 200));
            }
          }
        })()
      `);
    } catch {
      // best-effort
    }

    // Short final settle so any animation that started during the gates
    // gets a chance to land before we shoot.
    await new Promise((r) => setTimeout(r, 1200));

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
    const id = crypto.randomUUID().slice(0, 8);
    const filename = `${slug}-${date}-${id}.png`;
    const blobPath = `taste/${category}/${filename}`;

    const { imageUrl, thumbUrl, lqip } = await uploadImageWithThumb(blobPath, buffer, "image/png");

    const manifest = await readManifest();
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
