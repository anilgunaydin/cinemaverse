import { test, expect } from "@playwright/test";

test.describe("Yapım Sayfası - Bento Grid", () => {
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
    for (const heading of ["Konu", "Kişisel hafızanız", "Ekip", "Fragman"]) {
      await expect(
        page.locator(`h2:has-text("${heading}"), h3:has-text("${heading}")`).first()
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test("Bento grid - ilk ekranda birden fazla kart", async ({ page }) => {
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
      .locator('section:has(h2:text-is("Kişisel hafızanız"))')
      .first();
    await expect(panel).toBeVisible();

    const notes = panel.locator("#notes");
    await expect(notes).toBeHidden();

    await panel.locator('button:has-text("Detay ekle")').click();
    await expect(notes).toBeVisible({ timeout: 3000 });
  });
});
