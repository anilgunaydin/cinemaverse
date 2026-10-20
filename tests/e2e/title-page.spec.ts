import { test, expect } from "@playwright/test";

test.describe("Yapım Sayfası - Kompakt Tasarım", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('a[href^="/title/"]').first()).toBeVisible({
      timeout: 15000,
    });
    // Hover overlay'i tiklamayi engelleyebilir; dogrudan URL'e gidiyoruz.
    const href = await page
      .locator('a[href^="/title/"]')
      .first()
      .getAttribute("href");
    await page.goto(`http://localhost:3000${href}`);
    await expect(page.locator("h1")).toBeVisible({ timeout: 15000 });
  });

  test("Hero ilk ekranda sığar ve sekmeler görünür", async ({ page }) => {
    const hero = page.locator("main section").first();
    await expect(hero).toBeVisible();

    // Hero yuksekligi makul olmali (ekranin yarisini asmasin)
    const viewport = page.viewportSize();
    const box = await hero.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeLessThan(viewport!.height * 0.55);

    // Sekme cubugu ilk ekranda gorunmeli
    const tabs = page.locator('nav[aria-label="Yapım sayfası bölümleri"]');
    await expect(tabs).toBeVisible();
    const tabBox = await tabs.boundingBox();
    expect(tabBox!.y).toBeLessThan(viewport!.height);
  });

  test("Sekmeler arasinda geçiş yapılabilir", async ({ page }) => {
    const tabs = page.locator('nav[aria-label="Yapım sayfası bölümleri"] button');
    await expect(tabs).toHaveCount(5, { timeout: 30000 });

    // Özet varsayilan
    await expect(page.locator('h2:has-text("Konu")')).toBeVisible();

    // Yorumlar sekmesi
    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveAttribute("aria-current", "page", {
      timeout: 10000,
    });

    // Medya sekmesi
    await tabs.nth(2).click();
    await expect(tabs.nth(2)).toHaveAttribute("aria-current", "page", {
      timeout: 10000,
    });
    await expect(page.locator('h2:has-text("Fragman")')).toBeVisible({
      timeout: 10000,
    });

    // AI sekmesi
    await tabs.nth(4).click();
    await expect(tabs.nth(4)).toHaveAttribute("aria-current", "page", {
      timeout: 10000,
    });
    await expect(page.locator('h2:has-text("AI ile tartış")')).toBeVisible({
      timeout: 10000,
    });
  });

  test("Yayın platformları hero'da ve Medya sekmesinde görünür", async ({
    page,
  }) => {
    const tabs = page.locator('nav[aria-label="Yapım sayfası bölümleri"] button');
    await expect(tabs).toHaveCount(5, { timeout: 30000 });

    // Medya sekmesinde platform bolumu olmali
    await tabs.nth(2).click();
    await expect(
      page.locator('h3:has-text("Yayın Platformları")')
    ).toBeVisible({ timeout: 10000 });

    // Hero'da platform rozetleri veya "+N platform" gostergesi olmali
    const hero = page.locator("main section").first();
    const heroText = await hero.innerText();
    const hasPlatformHint =
      /Netflix|Disney|Amazon|HBO Max|Apple TV|Exxen|Blutv/i.test(heroText) ||
      /\+\d+\s*platform/i.test(heroText);
    expect(hasPlatformHint).toBeTruthy();
  });

  test("Kişisel hafıza kompakt - detaylar gizli başlar", async ({ page }) => {
    const panel = page.locator('section:has-text("Kişisel hafızanız")').first();
    await expect(panel).toBeVisible();

    // Detay formu kapali baslamali
    const notesField = panel.locator("#notes");
    await expect(notesField).toBeHidden();

    // "Detay ekle" butonu ile acilmali
    await panel.locator('button:has-text("Detay ekle")').click();
    await expect(notesField).toBeVisible({ timeout: 3000 });
  });

  test("?tab= ile doğrudan sekme açılabilir", async ({ page }) => {
    const url = page.url();
    await page.goto(`${url}?tab=medya`);

    // Once sekme cubugu gelsin (sayfa derlendi demektir)
    const tabs = page.locator('nav[aria-label="Yapım sayfası bölümleri"]');
    await expect(tabs).toBeVisible({ timeout: 30000 });

    // Medya sekmesi aktif olmali
    await expect(
      tabs.locator('button:has-text("Medya")')
    ).toHaveAttribute("aria-current", "page", { timeout: 10000 });

    await expect(page.locator('h2:has-text("Fragman")')).toBeVisible({
      timeout: 10000,
    });
  });
});
