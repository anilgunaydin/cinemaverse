import { test, expect } from "@playwright/test";

test.describe("Admin Paneli - Moderation", () => {
  test("Admin paneli erişilebilir ve moderasyon linki çalışır", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.locator("h1")).toContainText("Yönetim Paneli", { timeout: 10000 });

    // Moderasyon linki
    await expect(page.locator('a[href="/moderation"]:has-text("Moderasyon")')).toBeVisible();

    // Moderasyon sayfasına git
    await page.goto("/moderation");
    await expect(page.locator("h1")).toContainText("Moderasyon Paneli", { timeout: 10000 });
  });

  test("Rapor detayı açılabilir (rapor varsa)", async ({ page }) => {
    await page.goto("/moderation");
    await expect(page.locator("h1")).toContainText("Moderasyon Paneli", { timeout: 10000 });

    // İlk rapor satırı varsa tıkla
    const firstReport = page.locator("table tbody tr, .report-row, [data-report-id]").first();
    if (await firstReport.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstReport.click();
      await page.waitForTimeout(500);
      // Detay modalı veya sayfası
      await expect(page.locator("text=Detay, text=İncele, text=Karar ver, text=Çözüldü, text=Reddet").first()).toBeVisible({ timeout: 3000 });
    }
  });
});