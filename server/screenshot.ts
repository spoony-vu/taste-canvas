import { chromium } from "playwright";

export interface ScreenshotResult {
  title: string;
  description: string;
}

export async function captureScreenshot(
  url: string,
  outputPath: string
): Promise<ScreenshotResult> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
  } catch {
    // networkidle often hangs on heavy sites (WebGL, analytics) — fall back to domcontentloaded
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(3000);
  }

  const meta = await page.evaluate(`({
    title:
      document.querySelector('meta[property="og:title"]')?.getAttribute("content") ??
      document.title ??
      "",
    description:
      document.querySelector('meta[property="og:description"]')?.getAttribute("content") ?? "",
  })`) as { title: string; description: string };

  await page.screenshot({ path: outputPath, type: "png" });
  await browser.close();

  return meta;
}
