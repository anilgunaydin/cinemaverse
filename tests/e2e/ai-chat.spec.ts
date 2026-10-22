import { test, expect } from "@playwright/test";

test.describe("AI Sohbet", () => {
  test("Yapım sayfasında AI tartışma bölümü görünür", async ({ page }) => {
    // Bir yapım sayfasına git (hover overlay'i engelleyebilir, dogrudan URL)
    await page.goto("/");
    await expect(page.locator('a[href^="/title/"]').first()).toBeVisible({
      timeout: 15000,
    });
    const href = await page
      .locator('a[href^="/title/"]')
      .first()
      .getAttribute("href");
    await page.goto(`http://localhost:3000${href}`);

    await expect(page.locator("h1")).toBeVisible({ timeout: 15000 });

    // AI tartisma bolumu her zaman gorunur (sekme yok)
    await expect(page.locator('h2:has-text("AI ile tartış")')).toBeVisible({
      timeout: 15000,
    });

    // Durum rozeti: AI aciksa saglayici adi, kapaliysa "Kapali" yazmali.
    const status = await page.request.get("/api/ai/status");
    const data = await status.json();
    const chip = data.enabled
      ? page
          .locator('.chip:has-text("gemini"), .chip:has-text("openai")')
          .first()
      : page.locator('.chip:has-text("Kapalı")').first();
    await expect(chip).toBeVisible({ timeout: 5000 });
  });

  test("AI durum endpoint'i çalışıyor", async ({ page }) => {
    const response = await page.request.get("/api/ai/status");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    // AI ortamda varsa bulut saglayicisi, yoksa none olmali (enabled tutarli).
    expect(["gemini", "openai-compatible", "none"]).toContain(
      data.provider
    );
    if (data.provider === "none") {
      expect(data.enabled).toBe(false);
    }
  });
});
