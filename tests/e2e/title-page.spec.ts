import { test, expect } from "@playwright/test";

test.describe("Yapım Sayfası - Yerleşim", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
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
  });

  test("Hero ilk ekranda sığar", async ({ page }) => {
    const hero = page.locator("main > section").first();
    await expect(hero).toBeVisible();

    const viewport = page.viewportSize();
    const box = await hero.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeLessThan(viewport!.height * 0.55);
  });

  test("Tüm bölümler aynı anda görünür (sekme yok)", async ({ page }) => {
    // Sekme barı olmamalı
    await expect(
      page.locator('nav[aria-label="Yapım sayfası bölümleri"]')
    ).toHaveCount(0);

    // Ana bölümler görünür olmalı
    for (const heading of [
      "Konu",
      "Ekip",
      "Değerlendirmen",
      "Fragman",
    ]) {
      await expect(
        page.locator(`h2:has-text("${heading}"), h3:has-text("${heading}")`).first()
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test("İlk ekranda etkileşim kartı görünür", async ({ page }) => {
    const cards = page.locator("main .surface");
    await expect(cards.first()).toBeVisible();

    // Değerlendirmen hero'nun hemen altında başlamalı
    const evaluation = await page
      .locator('section:has(h2:text-is("Değerlendirmen"))')
      .first()
      .boundingBox();
    expect(evaluation).not.toBeNull();
    expect(evaluation!.y).toBeLessThan(900);

    const visibleInFold = await page.evaluate(() => {
      return [...document.querySelectorAll("main .surface")].filter(
        (el) => el.getBoundingClientRect().top < window.innerHeight
      ).length;
    });
    expect(visibleInFold).toBeGreaterThanOrEqual(2);
  });

  test("Kart yerleşimi: Değerlendirmen önde, Konu + Ekip tek Künye kartında", async ({
    page,
  }) => {
    const main = await page.locator("main").boundingBox();
    expect(main).not.toBeNull();

    // Değerlendirmen: tam genişlik, hero'nun hemen altında (etkileşim önce)
    const degerlendirmen = await page
      .locator('section:has(h2:text-is("Değerlendirmen"))')
      .first()
      .boundingBox();
    expect(degerlendirmen).not.toBeNull();
    expect(degerlendirmen!.width).toBeGreaterThan(main!.width * 0.85);
    expect(degerlendirmen!.y).toBeLessThan(900);

    // Konu ve Ekip tek "Künye" kartı içinde
    const kunye = page.locator('section:has(h2:text-is("Künye"))').first();
    await expect(kunye).toBeVisible();
    const kunyeBox = await kunye.boundingBox();
    expect(kunyeBox).not.toBeNull();
    expect(kunyeBox!.width).toBeGreaterThan(main!.width * 0.85);
    expect(kunyeBox!.y).toBeGreaterThan(degerlendirmen!.y);

    await expect(kunye.locator('h3:text-is("Konu")')).toBeVisible();
    await expect(kunye.locator('h3:text-is("Ekip")')).toBeVisible();

    // Konu/Ekip için ayrı kart kalmadı
    await expect(page.locator('section:has(h2:text-is("Konu"))')).toHaveCount(0);
    await expect(page.locator('section:has(h2:text-is("Ekip"))')).toHaveCount(0);

    // Künye kompakt kalmalı (referans bilgisi sayfayı domine etmemeli)
    expect(kunyeBox!.height).toBeLessThan(460);

    // Yatay taşma yok
    const overflowX = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1
    );
    expect(overflowX).toBe(false);

    // Kartlar içeriğe göre şişip sayfayı uzatmamalı
    const pageHeight = await page.evaluate(
      () => document.documentElement.scrollHeight
    );
    expect(pageHeight).toBeLessThan(2800);
  });

  test("Uzun listeler kart içinde kaydırılır", async ({ page }) => {
    // İnternet Yorumlari karti sayfayi domine etmemeli
    const comments = page
      .locator('section:has(h2:has-text("İnternet Yorumları"))')
      .first();
    if (await comments.isVisible().catch(() => false)) {
      const box = await comments.boundingBox();
      expect(box!.height).toBeLessThan(700);
    }
  });

  test("Yayın platformları sadece hero'da, tekrar yok", async ({ page }) => {
    const hero = page.locator("main > section").first();
    const heroText = await hero.innerText();
    expect(heroText.toLocaleLowerCase("tr")).toContain("nerede izlenir");

    // Grid icinde ayri bir platform karti OLMAMALI (tekrar yok)
    const gridCards = await page.evaluate(() => {
      return [...document.querySelectorAll("main .surface")].map(
        (el) => el.querySelector("h2, h3")?.textContent?.trim() ?? ""
      );
    });
    expect(
      gridCards.some((t) => t.includes("Yayın Platformları"))
    ).toBeFalsy();
  });

  test("Kişisel hafıza kompakt - detaylar gizli başlar", async ({ page }) => {
    const panel = page
      .locator('section:has(h2:text-is("Değerlendirmen"))')
      .first();
    await expect(panel).toBeVisible();

    const notes = panel.locator("#notes");
    await expect(notes).toBeVisible();

    // Detay alanlari gizli baslamali
    await expect(panel.locator("#liked")).toBeHidden();

    await panel.locator('button:has-text("Detay ekle")').click();
    await expect(panel.locator("#liked")).toBeVisible({ timeout: 3000 });
  });
});
