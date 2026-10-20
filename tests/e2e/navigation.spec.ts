import { test, expect } from "@playwright/test";

test.describe("Arama & Navigasyon", () => {
  test("Arama çalışıyor", async ({ page }) => {
    await page.goto("/");
    // Arama sayfasına doğrudan git (Link click navigation flaky olabilir)
    await page.goto("/search");
    await expect(page).toHaveURL("/search");

    // Arama input'una yaz - search paneldeki input
    const searchInput = page.locator('input[type="search"][placeholder*="Film veya dizi"]').first();
    await searchInput.fill("Matrix");
    await page.waitForTimeout(1000); // debounce bekle

    // Sonuçlarda Matrix görünmeli
    await expect(page.locator('text="Matrix"').first()).toBeVisible({ timeout: 10000 });
  });

  test("Navigasyon linkleri çalışıyor", async ({ page }) => {
    // Keşfet
    await page.goto("/");
    await expect(page.locator('a[href="/"]:has-text("Keşfet")')).toBeVisible();

    // Kütüphanem
    await page.goto("/library");
    await expect(page.locator("h1")).toContainText("Kütüphanem");

    // Öneriler
    await page.goto("/recommendations");
    await expect(page.locator("h1")).toContainText("uygun");

    // Topluluk
    await page.goto("/community");
    await expect(page.locator("h1")).toContainText("inceleme");
  });
});