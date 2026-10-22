import { test, expect } from "@playwright/test";

test.describe("Keşfet - Tür satırları", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("Yapımlar türlere ayrılır, her tür sağa kayan bir satırdır", async ({
    page,
  }) => {
    await page.goto("/");

    const rows = page.locator('section[id^="tur-"]');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(2);

    // Her satır: baslik + yatay kaydirilabilir bolge + kartlar
    const first = rows.first();
    await expect(first.locator("h3")).toBeVisible();
    const region = first.locator('[role="region"]');
    await expect(region).toBeVisible();

    const metrics = await region.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      cards: el.querySelectorAll('a[href^="/title/"]').length,
      scrollbar: getComputedStyle(el).scrollbarWidth,
    }));
    expect(metrics.cards).toBeGreaterThan(0);
    expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);
    // Geleneksek kaydirma cubugu gorunmez
    expect(metrics.scrollbar).toBe("none");

    // Genis ekranda bir seritte tam 3 kart gorunur ve kartlar buyumustur
    const layout = await region.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const cards = [...el.querySelectorAll('a[href^="/title/"]')];
      const fullyVisible = cards.filter((card) => {
        const rect = card.getBoundingClientRect();
        return rect.left >= box.left - 1 && rect.right <= box.right + 1;
      }).length;
      return {
        fullyVisible,
        cardWidth: Math.round(cards[0]?.getBoundingClientRect().width ?? 0),
      };
    });
    expect(layout.fullyVisible).toBe(3);
    expect(layout.cardWidth).toBeGreaterThan(300);

    // Aynı yapım birden fazla tür satırında tekrarlanmaz.
    const hrefs = await page
      .locator('section[id^="tur-"] a[href^="/title/"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    expect(hrefs.length).toBeGreaterThan(0);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  test("Film/dizi ayrımı rozetlerle görünür ve filtrelenebilir", async ({
    page,
  }) => {
    await page.goto("/");

    const badges = page.locator(
      'section[id^="tur-"] a[href^="/title/"] span:text-is("Dizi"), section[id^="tur-"] a[href^="/title/"] span:text-is("Film")',
    );
    expect(await badges.count()).toBeGreaterThan(0);

    const filters = page.locator('div[aria-label="Yapım türü"]');
    await expect(filters).toBeVisible();
    await filters.getByRole("link", { name: /^Diziler/ }).click();
    await expect(page).toHaveURL(/kind=series/, { timeout: 15000 });

    // Filtre sonrası yalnızca diziler listelenir
    const rows = page.locator('section[id^="tur-"]');
    await expect(rows.first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('section[id^="tur-"] span:text-is("Film")')).toHaveCount(0);
    expect(
      await page.locator('section[id^="tur-"] span:text-is("Dizi")').count(),
    ).toBeGreaterThan(0);
  });

  test("Ok düğmeleri satırı sağa/sola kaydırır", async ({ page }) => {
    await page.goto("/");

    const section = page.locator('section[id^="tur-"]').first();
    const region = section.locator('[role="region"]');
    const right = section.getByRole("button", { name: /sağa kaydır/ }).first();
    const left = section.getByRole("button", { name: /sola kaydır/ }).first();

    // Sol ok baslangicta pasif
    await expect(left).toBeDisabled();
    await expect(right).toBeEnabled();

    // Oklar seritle orantili buyuklukte (yuzde 50 buyutuldu: >= 66px)
    const arrowBox = await right.boundingBox();
    expect(arrowBox).not.toBeNull();
    expect(arrowBox!.width).toBeGreaterThanOrEqual(66);

    // Ilk tam gorunen kartin indeksi
    const visibleIndex = () =>
      region.evaluate((el) => {
        const box = el.getBoundingClientRect();
        const cards = [...el.querySelectorAll('a[href^="/title/"]')];
        return cards.findIndex((card) => {
          const rect = card.getBoundingClientRect();
          return rect.left >= box.left - 2;
        });
      });

    const beforeIndex = await visibleIndex();
    expect(beforeIndex).toBe(0);

    await right.click();
    await page.waitForTimeout(1200);

    const afterRight = await region.evaluate((el) =>
      Math.round(el.scrollLeft),
    );
    expect(afterRight).toBeGreaterThan(0);
    // Bir tikta tam 2 yapim kayar.
    expect(await visibleIndex()).toBe(beforeIndex + 2);
    await expect(left).toBeEnabled();

    await left.click();
    await page.waitForTimeout(1200);
    const afterLeft = await region.evaluate((el) => Math.round(el.scrollLeft));
    expect(afterLeft).toBeLessThan(afterRight);
    expect(await visibleIndex()).toBe(beforeIndex);
  });

  test("Tür adları ham Wikidata kimliği değil", async ({ page }) => {
    await page.goto("/");
    const names = await page
      .locator('section[id^="tur-"] h3 span:first-child')
      .allInnerTexts();
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(name.trim()).not.toMatch(/^Q\d+$/);
    }
  });

  test("Arama büyük/küçük harf ve Türkçe karakterden bağımsız çalışır", async ({
    page,
  }) => {
    await page.goto("/?q=inception");
    const results = page.locator('section[id^="tur-"] a[href^="/title/"]');
    await expect(results).toHaveCount(1, { timeout: 15000 });
    await expect(results.first()).toHaveAttribute("href", /\/title\//);

    await page.goto("/?q=INCEPTION");
    await expect(results).toHaveCount(1, { timeout: 15000 });
  });

  test("Sayfada yatay taşma yok", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflow).toBe(false);
  });
});
