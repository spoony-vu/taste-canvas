import { chromium } from "playwright";

export async function captureScreenshot(
  url: string,
  outputPath: string
): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });

  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  // Let animations/lazy images settle
  await page.waitForTimeout(1500);
  await page.screenshot({ path: outputPath, type: "png" });
  await browser.close();
}
