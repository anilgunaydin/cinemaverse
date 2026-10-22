import { test, expect } from "@playwright/test";

/** Hero'dan acilan "Değerlendirmen" penceresi */
const openEvaluation = async (page: any) => {
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

  const card = page.locator('[role="dialog"][aria-label="Değerlendirmen"]');
  await expect(card).toBeVisible({ timeout: 5000 });
  return card;
};

test.describe("Kütüphane - Değerlendirme Kartı", () => {
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

  test("Kart üç bölümü birleştirir: hafıza + inceleme + topluluk", async ({
    page,
  }) => {
    const card = await openEvaluation(page);
    await expect(card).toBeVisible();

    // Kişisel hafıza parçaları
    await expect(card.locator('button:has-text("İzledim")')).toBeVisible();
    await expect(card.locator('button:has-text("İzliyorum")')).toBeVisible();
    await expect(card.locator('button[aria-label="10 puan"]')).toBeVisible();

    // Kişisel not (özel)
    await expect(card.locator("#notes")).toBeVisible();

    // Herkese açık inceleme
    await expect(card.locator("#review-body")).toBeVisible();
    await expect(card.locator("#review-visibility")).toBeVisible();

    // Topluluk incelemeleri aynı kart içinde
    await expect(
      card.locator('h3:has-text("Topluluk incelemeleri")')
    ).toBeVisible();

    // Detaylar gizli başlar
    await expect(card.locator("#liked")).toBeHidden();
  });

  test("Puan tek yerden yönetilir (hafıza + inceleme)", async ({ page }) => {
    const card = await openEvaluation(page);
    const r9 = card.locator('button[aria-label="9 puan"]');
    const before = await r9.getAttribute("aria-pressed");
    await r9.click();
    await expect(r9).not.toHaveAttribute("aria-pressed", before ?? "false", {
      timeout: 5000,
    });
  });

  test("Kaydet hem hafızayı hem incelemeyi yazar", async ({ page }) => {
    const card = await openEvaluation(page);
    const titleId = page.url().split("/title/")[1]?.split("?")[0] ?? "";

    // Gercek DB'yi kirletmemek icin onceki degerleri sakla
    const originalNotes = await card.locator("#notes").inputValue();
    const originalReview = await card.locator("#review-body").inputValue();
    const pressedRating = card.locator(
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
    // Ayni degere tiklamak puani kaldirir; farkli bir deger sec
    const targetRating = originalRatingValue === 8 ? 7 : 8;

    // Not yaz
    await card.locator("#notes").fill("Otomatik test notu.");
    // İnceleme yaz
    await card.locator("#review-body").fill("Otomatik test incelemesi.");
    // Puan ver
    await card.locator(`button[aria-label="${targetRating} puan"]`).click();

    // Kaydet
    await card
      .locator('button:has-text("Kaydet"), button:has-text("Kütüphaneye ekle")')
      .first()
      .click();

    await expect(card.locator("text=Kaydedildi")).toBeVisible({ timeout: 15000 });

    // Test verisini geri al (gercek kutuphane bozulmasin)
    await card.locator("#notes").fill(originalNotes);
    await card.locator("#review-body").fill(originalReview);
    if (originalRatingValue === null) {
      await card
        .locator('button[aria-pressed="true"][aria-label$="puan"]')
        .first()
        .click();
    } else {
      await card
        .locator(`button[aria-label="${originalRatingValue} puan"]`)
        .click();
    }
    await card
      .locator('button:has-text("Kaydet"), button:has-text("Kütüphaneye ekle")')
      .first()
      .click();
    await page.waitForTimeout(1500);

    // Once inceleme yoktuysa olusturulan incelemeyi API ile sil
    if (!originalReview.trim()) {
      const after = await page.request.get(
        `/api/reviews?titleId=${encodeURIComponent(titleId)}`
      );
      const afterData = after.ok() ? await after.json() : {};
      const testReview = (afterData.items ?? []).find((r: any) =>
        r.body?.includes("Otomatik test")
      );
      if (testReview) {
        await page.request.delete(
          `/api/reviews?reviewId=${encodeURIComponent(testReview.id)}`
        );
      }
    }
  });

  test("Detaylar açılıp kapatılabilir", async ({ page }) => {
    const card = await openEvaluation(page);
    const liked = card.locator("#liked");
    await expect(liked).toBeHidden();

    await card.locator('button:has-text("Detay ekle")').click();
    await expect(liked).toBeVisible();
    await expect(card.locator("#disliked")).toBeVisible();
    await expect(card.locator("#scenes")).toBeVisible();

    await card.locator('button:has-text("Detayları gizle")').click();
    await expect(liked).toBeHidden();
  });
});
