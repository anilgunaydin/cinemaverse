import { test, expect } from "@playwright/test";

test.describe("Bildirimler", () => {
  // storageState zaten giris yapmis durumda (auth.setup.ts)
  test("Bildirim zili header'da görünür ve tıklanabilir", async ({ page }) => {
    await page.goto("/");
    const bell = page.locator('button[aria-label="Bildirimler"]');
    await expect(bell).toBeVisible({ timeout: 10000 });

    await bell.click();
    await page.waitForTimeout(500);

    // Dropdown acildi
    const menu = page.locator('[role="menu"]');
    await expect(menu).toBeVisible({ timeout: 5000 });

    // Ya bildirim listesi var ya da "Bildirim yok" mesaji
    await expect(
      menu.locator('text="Bildirim yok"').or(menu.locator("ul li")).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("Bildirimler sayfasi acilir", async ({ page }) => {
    await page.goto("/notifications");
    await expect(page.locator("h1")).toContainText("Bildirimler", { timeout: 10000 });
    // Filtre butonlari
    await expect(page.locator('button:has-text("Tümü")')).toBeVisible();
    await expect(page.locator('button:has-text("Okunmamış")')).toBeVisible();
  });

  test("Bildirim API'si calisiyor", async ({ page }) => {
    const response = await page.request.get("/api/notifications?limit=5");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(Array.isArray(data.notifications)).toBeTruthy();
    expect(typeof data.unreadCount).toBe("number");
  });

  test("Tum bildirimleri okundu isaretleme calisir", async ({ page }) => {
    const response = await page.request.patch("/api/notifications/read", {
      data: { markAllRead: true },
    });
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.ok).toBe(true);
  });
});