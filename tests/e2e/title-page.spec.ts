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
    for (const heading of ["Konu", "Ekip", "Fragman"]) {
      await expect(
        page.locator(`h2:has-text("${heading}"), h3:has-text("${heading}")`).first()
      ).toBeVisible({ timeout: 10000 });
    }

    // Değerlendirme artık sayfada ayrı kart kaplamıyor; hero'dan açılıyor
    await expect(
      page.locator('main section:has(h2:text-is("Değerlendirmen"))')
    ).toHaveCount(0);
  });

  test("İlk ekranda hero ve etkileşim kartları görünür", async ({ page }) => {
    const hero = page.locator("main > section").first();
    await expect(hero).toBeVisible();

    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            return [...document.querySelectorAll("main .surface")].filter(
              (el) => el.getBoundingClientRect().top < window.innerHeight
            ).length;
          }),
        { timeout: 10000 },
      )
      .toBeGreaterThanOrEqual(2);
  });

  test("Kart yerleşimi: Değerlendirme hero'da, Konu + Ekip tek Künye kartında", async ({
    page,
  }) => {
    const main = await page.locator("main").boundingBox();
    expect(main).not.toBeNull();

    const hero = await page.locator("main > section").first().boundingBox();
    expect(hero).not.toBeNull();

    // Değerlendirme girişi hero içinde (ayrı kart yok)
    await expect(
      page
        .locator("main > section")
        .first()
        .locator('button[aria-label="Puanını hızlıca değerlendir"]')
    ).toBeVisible();

    // Konu ve Ekip tek "Künye" kartı içinde
    const kunye = page.locator('section:has(h2:text-is("Künye"))').first();
    await expect(kunye).toBeVisible();
    const kunyeBox = await kunye.boundingBox();
    expect(kunyeBox).not.toBeNull();
    expect(kunyeBox!.width).toBeGreaterThan(main!.width * 0.85);
    expect(kunyeBox!.y).toBeGreaterThan(hero!.y);

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

  test("Yabancı yorumlar Türkçeye çevrilebilir", async ({ page }) => {
    const foreign = page.locator(
      'section:has(h2:text-is("İnternet Yorumları")) li:has(button:text-is("Türkçeye çevir"))',
    );
    const count = await foreign.count();
    test.skip(count === 0, "Bu yapımda yabancı yorum yok.");

    // Düğme görünür ve tıklanabilir olmalı
    await expect(foreign.first().locator("button")).toBeEnabled();
  });

  test("Kişisel hafıza kompakt - detaylar gizli başlar", async ({ page }) => {
    const trigger = page
      .locator(
        'button[aria-haspopup="dialog"][aria-label="Puanını hızlıca değerlendir"]',
      )
      .first();
    await trigger.click();

    const quick = page.locator(
      '[role="dialog"][aria-label="Hızlı değerlendirme"]',
    );
    await expect(quick).toBeVisible();
    await quick.locator('button:has-text("Detaylı değerlendirme")').click();
    await expect(quick).toBeHidden();

    const panel = page.locator('[role="dialog"][aria-label="Değerlendirmen"]');
    await expect(panel).toBeVisible({ timeout: 5000 });

    const notes = panel.locator("#notes");
    await expect(notes).toBeVisible();

    // Detay alanlari gizli baslamali
    await expect(panel.locator("#liked")).toBeHidden();

    await panel.locator('button:has-text("Detay ekle")').click();
    await expect(panel.locator("#liked")).toBeVisible({ timeout: 3000 });

    await panel.locator('button[aria-label="Kapat"]').click();
    await expect(panel).toBeHidden();
  });

  test("Hero'daki puan kutusu hızlı değerlendirme penceresi açar", async ({
    page,
  }) => {
    const trigger = page
      .locator('button[aria-haspopup="dialog"][aria-label="Puanını hızlıca değerlendir"]')
      .first();
    await expect(trigger).toBeVisible();
    await expect(trigger).toContainText("Sizin puanınız");

    await trigger.hover();
    const dialog = page.locator(
      '[role="dialog"][aria-label="Hızlı değerlendirme"]',
    );
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog.locator('h3:text-is("Değerlendirmen")')).toBeVisible();
    await expect(dialog.locator('button[aria-label="10 puan"]')).toBeVisible();
    await expect(dialog.locator('button:text-is("İzledim")')).toBeVisible();

    // Detayli baglanti tam degerlendirme penceresini acar
    await dialog.locator('button:has-text("Detaylı değerlendirme")').click();
    await expect(dialog).toBeHidden();
    await expect(
      page.locator('[role="dialog"][aria-label="Değerlendirmen"]'),
    ).toBeVisible({ timeout: 5000 });
  });

  test("Hızlı değerlendirme kaydedilir ve hero'ya yansır", async ({ page }) => {
    const trigger = page
      .locator('button[aria-haspopup="dialog"][aria-label="Puanını hızlıca değerlendir"]')
      .first();
    const dialog = page.locator(
      '[role="dialog"][aria-label="Hızlı değerlendirme"]',
    );

    await trigger.click();
    await expect(dialog).toBeVisible();

    // Mevcut durumu sakla (gercek kutuphane bozulmasin)
    const pressedStatus = dialog.locator('button[aria-pressed="true"]').first();
    const originalStatus = (await pressedStatus.count())
      ? await pressedStatus.innerText()
      : null;

    const pressedRating = dialog.locator(
      'button[aria-pressed="true"][aria-label$="puan"]',
    );
    const originalRatingValue = (await pressedRating.count())
      ? Number(
          (await pressedRating.first().getAttribute("aria-label"))?.replace(
            " puan",
            "",
          ),
        )
      : null;

    const save = async () => {
      const responsePromise = page.waitForResponse(
        (response) =>
          response.url().includes("/api/library") &&
          response.request().method() === "POST",
        { timeout: 15000 },
      );
      await dialog.locator('button:text-is("Kaydet")').click();
      const response = await responsePromise;
      expect(response.ok()).toBeTruthy();
    };

    const expectTriggerRating = async (value: number | null) => {
      await expect
        .poll(
          async () => {
            const text = (await trigger.innerText()).replace(/\s+/g, " ");
            return text.includes(value === null ? "—" : `${value}/10`);
          },
          { timeout: 15000 },
        )
        .toBe(true);
    };

    // Mevcut puandan FARKLI bir deger sec (ayni degere tiklamak secimi kaldirir)
    const newRating = originalRatingValue === 7 ? 8 : 7;

    // 1) Yeni puan yaz
    await dialog.locator(`button[aria-label="${newRating} puan"]`).click();
    await expect(dialog.locator(`text=${newRating}/10`)).toBeVisible();
    await save();
    await expectTriggerRating(newRating);

    // 2) Eski degeri geri yaz
    if (originalStatus) {
      await dialog.locator(`button:text-is("${originalStatus}")`).click();
    }
    if (originalRatingValue === null) {
      await dialog
        .locator('button[aria-pressed="true"][aria-label$="puan"]')
        .first()
        .click();
    } else {
      await dialog
        .locator(`button[aria-label="${originalRatingValue} puan"]`)
        .click();
    }
    await save();
    await expectTriggerRating(originalRatingValue);
  });
});
