import { test, expect } from "@playwright/test";

test.describe("Keşfet - Tür satırları", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("Yapımlar türlere ayrılır, her tür sağa kayan bir satırdır", async ({
    page,
  }) => {
    await page.goto("/");

    const rows = page.locator('section[id^="tur-"]');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(2);

    // Her satır: baslik + yatay kaydirilabilir bolge + kartlar
    const first = rows.first();
    await expect(first.locator("h3")).toBeVisible();
    const region = first.locator('[role="region"]');
    await expect(region).toBeVisible();

    const metrics = await region.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      cards: el.querySelectorAll('a[href^="/title/"]').length,
    }));
    expect(metrics.cards).toBeGreaterThan(0);
    expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);
  });

  test("Ok düğmeleri satırı sağa/sola kaydırır", async ({ page }) => {
    await page.goto("/");

    const section = page.locator('section[id^="tur-"]').first();
    const region = section.locator('[role="region"]');
    const right = section.getByRole("button", { name: /sağa kaydır/ }).first();
    const left = section.getByRole("button", { name: /sola kaydır/ }).first();

    // Sol ok baslangicta pasif
    await expect(left).toBeDisabled();
    await expect(right).toBeEnabled();

    await right.click();
    await expect
      .poll(async () => region.evaluate((el) => Math.round(el.scrollLeft)), {
        timeout: 5000,
      })
      .toBeGreaterThan(0);

    await expect(left).toBeEnabled();
    const afterRight = await region.evaluate((el) =>
      Math.round(el.scrollLeft),
    );
    await left.click();
    await expect
      .poll(async () => region.evaluate((el) => Math.round(el.scrollLeft)), {
        timeout: 5000,
      })
      .toBeLessThan(afterRight);
  });

  test("Tür adları ham Wikidata kimliği değil", async ({ page }) => {
    await page.goto("/");
    const names = await page
      .locator('section[id^="tur-"] h3 span:first-child')
      .allInnerTexts();
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(name.trim()).not.toMatch(/^Q\d+$/);
    }
  });

  test("Sayfada yatay taşma yok", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflow).toBe(false);
  });
});
