import { expect, test } from "@playwright/test";

const smokeManifest = {
  items: [
    {
      id: "smoke1",
      title: "Smoke Landing",
      url: "https://example.com",
      image:
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='420'%3E%3Crect width='640' height='420' fill='%23222'/%3E%3Ctext x='80' y='220' fill='white' font-size='48'%3ESmoke%3C/text%3E%3C/svg%3E",
      category: "ui",
      tags: ["landing-pages"],
      added: "2026-05-11",
      width: 640,
      height: 420,
    },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/manifest", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: smokeManifest });
      return;
    }
    await route.fallback();
  });
});

test("loads the board shell", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto("/");

  await expect(page).toHaveTitle(/Taste Canvas/);
  await expect(page.locator("#root")).not.toBeEmpty();
  await expect(page.locator("[data-taste-card-id='smoke1']")).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test("switches layouts and opens the lightbox", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Grid layout").click();
  await expect(page.locator("[data-taste-card-id='smoke1']")).toBeVisible();

  await page.getByLabel("Feed layout").click();
  await expect(page.locator("[data-taste-card-id='smoke1']")).toBeVisible();

  await page.getByLabel("Masonry layout").click();
  await page.getByLabel("Open Smoke Landing").click();
  await expect(page.getByRole("dialog", { name: "Preview: Smoke Landing" })).toBeVisible();

  await page.getByLabel("Close lightbox").click();
  await expect(page.getByRole("dialog", { name: "Preview: Smoke Landing" })).toBeHidden();
});
