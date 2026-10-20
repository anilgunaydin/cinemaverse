import { test, expect } from "@playwright/test";

test.describe("Auth & Profil", () => {
  test("Profil sayfası açılır ve Wrapped/Karakter kartları görünür", async ({ page }) => {
    await page.goto("/profile");
    await expect(page.locator("h1")).toContainText("Anıl");
    await expect(page.locator('a[href="/wrapped"]')).toBeVisible();
    await expect(page.locator('a[href="/karakter"]')).toBeVisible();
  });

  test("Wrapped sayfası yüklenir ve istatistikler görünür", async ({ page }) => {
    await page.goto("/wrapped");
    await expect(page.locator("h1")).toContainText("Sinema Wrapped");
    await expect(page.locator(".font-display.text-3xl").first()).toBeVisible(); // 63
    await expect(page.locator("text=Tür Haritası")).toBeVisible();
    await expect(page.locator("text=Zaman Tüneli")).toBeVisible();
  });

  test("Karakter sayfası yüklenir ve profil gösterilir", async ({ page }) => {
    await page.goto("/karakter");
    await expect(page.locator("h1")).toContainText("Sinema Karakterin");
    // Skeleton'dan sonra profil gelir (max 15sn)
    await expect(page.locator(".font-display.text-3xl")).toBeVisible({ timeout: 20000 });
    await expect(page.locator("text=Güçlü Yönlerin")).toBeVisible({ timeout: 20000 });
  });
});