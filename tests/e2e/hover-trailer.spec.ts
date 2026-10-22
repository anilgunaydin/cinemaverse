import { test, expect } from "@playwright/test";

test.describe("Keşfet Grid - Hover Trailer", () => {
  test("Kart hoverında fragman kart içinde açılır, kart büyümez", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator('a[href^="/title/"]').first()).toBeVisible({
      timeout: 10000,
    });

    // Fragmanı olan bir kart seç (her yapımda fragman yok).
    const firstCard = page
      .locator('a[href^="/title/"]:has([data-hover-trailer])')
      .first();
    await expect(firstCard).toBeVisible({ timeout: 10000 });
    await firstCard.evaluate((element) =>
      element.scrollIntoView({ block: "center" }),
    );
    await page.waitForTimeout(150);

    const media = firstCard.locator(".aspect-video");
    const mediaBefore = await media.boundingBox();
    const cardBefore = await firstCard.boundingBox();
    expect(mediaBefore).not.toBeNull();
    expect(cardBefore).not.toBeNull();

    // Kartın tamamı yerine görsel alanındaki hover katmanına gel.
    await firstCard.locator("[data-hover-trailer]").hover();
    await page.waitForTimeout(500); // 200ms delay + iframe

    const panel = page.locator("[data-hover-trailer-panel]");
    await expect(panel).toBeVisible({ timeout: 5000 });

    // Video iframe var mı?
    const iframe = panel.locator("iframe");
    await expect(iframe).toHaveAttribute("src", /youtube(-nocookie)?\.com/);

    // Panel kartın dışına taşmıyor; tam olarak görsel alanını kaplıyor.
    const panelBox = await panel.boundingBox();
    const mediaAfter = await media.boundingBox();
    expect(panelBox).not.toBeNull();
    expect(mediaAfter).not.toBeNull();
    expect(panelBox!.width).toBeCloseTo(mediaAfter!.width, 0);
    expect(panelBox!.height).toBeCloseTo(mediaAfter!.height, 0);

    // Hover büyüme/ziplama yok: kart ve görsel transform almaz, boyut aynı kalır.
    const cardAfter = await firstCard.boundingBox();
    expect(cardAfter).not.toBeNull();
    expect(cardAfter!.width).toBeCloseTo(cardBefore!.width, 0);
    expect(cardAfter!.height).toBeCloseTo(cardBefore!.height, 0);

    const cardTransform = await firstCard.evaluate(
      (element) => getComputedStyle(element).transform,
    );
    expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(cardTransform);

    const imageTransform = await firstCard
      .locator("img")
      .first()
      .evaluate((element) => getComputedStyle(element).transform);
    expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(imageTransform);
  });

  test("Global mute - ikinci kart hoverında ses durumu korunur", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator('a[href^="/title/"]').first()).toBeVisible({
      timeout: 10000,
    });

    const cards = page.locator(
      'a[href^="/title/"]:has([data-hover-trailer])',
    );
    const firstCard = cards.first();
    const secondCard = cards.nth(1);

    // İlk kart hover -> panel aç
    await firstCard.locator("[data-hover-trailer]").hover();
    await page.waitForTimeout(500);
    const panel = page.locator("[data-hover-trailer-panel]");
    await expect(panel).toBeVisible();

    // Mute butonuna tıkla (varsa - paneldeki mute toggle)
    const muteBtn = panel.locator(
      "button[aria-label*='Sesi'], button[aria-label*='Ses'], button[aria-label*='ses'], button[aria-label*='mute'], button[aria-label*='Mute']",
    );
    if (await muteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await muteBtn.click();
      await page.waitForTimeout(300);
    }

    // Mouse'u sayfa dışına taşı (hover'ı kapat)
    await page.mouse.move(0, 0);
    await page.waitForTimeout(500);

    // İkinci kart hover -> panel aç -> mute durumu aynı olmalı
    await secondCard.locator("[data-hover-trailer]").hover();
    await page.waitForTimeout(500);
    const panel2 = page.locator("[data-hover-trailer-panel]");
    await expect(panel2).toBeVisible();

    // Mute durumu kontrolü (iframe src'de mute=1 veya mute=0)
    const iframe2 = panel2.locator("iframe");
    const src2 = await iframe2.getAttribute("src");
    expect(src2).toContain("youtube-nocookie.com");
    expect(src2).toContain("mute=0");
  });

  test("Kart oranı 16:9 (landscape)", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('a[href^="/title/"]').first()).toBeVisible({
      timeout: 10000,
    });

    const media = page
      .locator('a[href^="/title/"]:has([data-hover-trailer]) .aspect-video')
      .first();
    const box = await media.boundingBox();
    expect(box).not.toBeNull();
    const ratio = box!.width / box!.height;
    expect(ratio).toBeGreaterThan(1.7);
    expect(ratio).toBeLessThan(1.85);
  });
});
