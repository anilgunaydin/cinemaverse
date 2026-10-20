import { test, expect } from "@playwright/test";

test.describe("Sinema Karakterin", () => {
  test("Tahminler oran rozetiyle listelenir", async ({ page }) => {
    await page.goto("/karakter");
    await expect(page.locator("h1")).toContainText("Sinema Karakterin", {
      timeout: 15000,
    });

    const strong = page
      .locator("section", { has: page.locator("h3:has-text('Güçlü Yönlerin')") })
      .first();
    await expect(strong).toBeVisible({ timeout: 15000 });

    // En az bir öğede yüzde rozeti olmalı
    const chips = strong.locator("li .chip");
    expect(await chips.count()).toBeGreaterThan(0);
    await expect(chips.first()).toContainText("%");
  });

  test("Öneriler kartı tahminlerle aynı formda (liste)", async ({ page }) => {
    await page.goto("/karakter");
    const recs = page
      .locator("section", { has: page.locator("h3:has-text('Sana Özel Öneriler')") })
      .first();
    await expect(recs).toBeVisible({ timeout: 15000 });

    // Liste bicimi (ul > li) - kart degil
    const items = recs.locator("ul > li");
    expect(await items.count()).toBeGreaterThan(0);

    // Okulari ayni: her oge "→" ile basliyor
    await expect(items.first()).toContainText("→");
  });

  test("Yorum satirlari sayfaya sizmasin", async ({ page }) => {
    await page.goto("/karakter");
    await page.waitForTimeout(2000);
    const body = await page.innerText("body");
    expect(body).not.toContain("/*");
  });
});
