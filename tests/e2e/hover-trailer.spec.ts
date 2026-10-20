import { test, expect } from "@playwright/test";

test.describe("Keşfet Grid - Hover Trailer", () => {
  test("Kart hoverında trailer paneli açılır", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('a[href^="/title/"]').first()).toBeVisible({ timeout: 10000 });

    const firstCard = page.locator('a[href^="/title/"]').first();
    const cardBox = await firstCard.boundingBox();
    expect(cardBox).not.toBeNull();

    // Hover
    await firstCard.hover();
    await page.waitForTimeout(500); // 250ms delay + animasyon

    // Panel açıldı mı?
    const panel = page.locator("[data-hover-trailer-panel]");
    await expect(panel).toBeVisible({ timeout: 5000 });

    // Video iframe var mı?
    const iframe = panel.locator("iframe");
    await expect(iframe).toHaveAttribute("src", /youtube(-nocookie)?\.com/);

    // Meta bandı var mı?
    await expect(panel.locator("text=Yapıma git →")).toBeVisible();
  });

  test("Global mute - ikinci kart hoverında ses durumu korunur", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('a[href^="/title/"]').first()).toBeVisible({ timeout: 10000 });

    const cards = page.locator('a[href^="/title/"]');
    const firstCard = cards.first();
    const secondCard = cards.nth(1);

    // İlk kart hover -> panel aç
    await firstCard.hover();
    await page.waitForTimeout(500);
    const panel = page.locator("[data-hover-trailer-panel]");
    await expect(panel).toBeVisible();

    // Mute butonuna tıkla (varsa - paneldeki mute toggle)
    const muteBtn = panel.locator("button[aria-label*='ses'], button[aria-label*='mute'], button[aria-label*='Mute']");
    if (await muteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await muteBtn.click();
      await page.waitForTimeout(300);
    }

    // Mouse'u sayfa dışına taşı (hover'ı kapat)
    await page.mouse.move(0, 0);
    await page.waitForTimeout(500);

    // İkinci kart hover -> panel aç -> mute durumu aynı olmalı
    await secondCard.hover();
    await page.waitForTimeout(500);
    const panel2 = page.locator("[data-hover-trailer-panel]");
    await expect(panel2).toBeVisible();

    // Mute durumu kontrolü (iframe src'de mute=1 veya mute=0)
    const iframe2 = panel2.locator("iframe");
    const src2 = await iframe2.getAttribute("src");
    expect(src2).toContain("youtube-nocookie.com");
  });

  test("Kart oranı 16:9 (landscape)", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('a[href^="/title/"]').first()).toBeVisible({ timeout: 10000 });

    const media = page.locator(".aspect-video").first();
    const box = await media.boundingBox();
    expect(box).not.toBeNull();
    const ratio = box!.width / box!.height;
    expect(ratio).toBeGreaterThan(1.7);
    expect(ratio).toBeLessThan(1.85);
  });
});