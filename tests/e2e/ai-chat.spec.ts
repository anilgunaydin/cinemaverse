import { test, expect } from "@playwright/test";

test.describe("AI Sohbet", () => {
  test("Yapım sayfasında AI tartışma bölümü görünür", async ({ page }) => {
    // Bir yapım sayfasına git
    await page.goto("/");
    await expect(page.locator('a[href^="/title/"]').first()).toBeVisible({ timeout: 10000 });
    const firstTitleLink = page.locator('a[href^="/title/"]').first();
    await firstTitleLink.click();

    await expect(page.locator("h1")).toBeVisible({ timeout: 10000 });

    // AI tartışma bölümü görünmeli
    await expect(page.locator('h2:has-text("AI ile tartış")')).toBeVisible({ timeout: 10000 });

    // AI durumu chip'i (ollama) görünmeli
    await expect(page.locator('.chip:has-text("ollama")').first()).toBeVisible({ timeout: 5000 });
  });

  test("AI durum endpoint'i çalışıyor", async ({ page }) => {
    const response = await page.request.get("/api/ai/status");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.provider).toBe("ollama");
    expect(data.enabled).toBe(true);
  });
});