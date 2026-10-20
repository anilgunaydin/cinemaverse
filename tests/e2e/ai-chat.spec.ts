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

    // Durum rozeti: AI aciksa saglayici adi, kapaliysa "Kapali" yazmali.
    const status = await page.request.get("/api/ai/status");
    const data = await status.json();
    const chip = data.enabled
      ? page.locator('.chip:has-text("ollama")').first()
      : page.locator('.chip:has-text("Kapalı")').first();
    await expect(chip).toBeVisible({ timeout: 5000 });
  });

  test("AI durum endpoint'i çalışıyor", async ({ page }) => {
    const response = await page.request.get("/api/ai/status");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    // AI ortamda varsa ollama, yoksa none olmali (ve enabled baytagi tutarli).
    expect(["ollama", "gemini", "openai-compatible", "none"]).toContain(
      data.provider
    );
    if (data.provider === "none") {
      expect(data.enabled).toBe(false);
    }
  });
});
