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

  test("İlk ekranda birden fazla kart görünür", async ({ page }) => {
    const cards = page.locator("main .surface");
    await expect(cards.first()).toBeVisible();

    // İlk ekranda en az 3 kart görünmeli
    const visibleInFold = await page.evaluate(() => {
      return [...document.querySelectorAll("main .surface")].filter(
        (el) => el.getBoundingClientRect().top < window.innerHeight
      ).length;
    });
    expect(visibleInFold).toBeGreaterThanOrEqual(3);
  });

  test("Kart yerleşimi: Konu tam genişlik, Ekip + Değerlendirmen yan yana", async ({
    page,
  }) => {
    const boxOf = async (name: string) => {
      const loc = page.locator(`section:has(h2:text-is("${name}"))`).first();
      if ((await loc.count()) === 0) return null;
      const box = await loc.boundingBox();
      expect(box).not.toBeNull();
      return box!;
    };

    const main = await page.locator("main").boundingBox();
    expect(main).not.toBeNull();

    // Konu: değişken uzunlukta olduğu için tam genişlikte tek satır kart
    const konu = await boxOf("Konu");
    expect(konu).not.toBeNull();
    expect(konu!.width).toBeGreaterThan(main!.width * 0.85);

    // Ekip ve Değerlendirmen aynı satırda, eşit yükseklikte
    const ekip = await boxOf("Ekip");
    const degerlendirmen = await boxOf("Değerlendirmen");
    expect(degerlendirmen).not.toBeNull();
    if (ekip) {
      expect(Math.abs(ekip.y - degerlendirmen!.y)).toBeLessThan(4);
      expect(Math.abs(ekip.height - degerlendirmen!.height)).toBeLessThan(4);
      expect(ekip.x + ekip.width).toBeLessThanOrEqual(degerlendirmen!.x + 1);
    }

    // Yatay taşma yok
    const overflowX = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1
    );
    expect(overflowX).toBe(false);

    // Kartlar içeriğe göre şişip sayfayı uzatmamalı
    const pageHeight = await page.evaluate(
      () => document.documentElement.scrollHeight
    );
    expect(pageHeight).toBeLessThan(3200);
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
