import { test, expect } from "@playwright/test";

test.describe("Kütüphane - Ekle/Sil/Puanla", () => {
  test("Yapım sayfasından kütüphaneye ekleme", async ({ page }) => {
    // Herhangi bir yapım sayfasına git
    await page.goto("/");
    await expect(page.locator('a[href^="/title/"]').first()).toBeVisible({ timeout: 10000 });
    const firstTitleLink = page.locator('a[href^="/title/"]').first();
    const href = await firstTitleLink.getAttribute("href");
    await firstTitleLink.click();

    // Sayfa yüklendi
    await expect(page.locator("h1")).toBeVisible({ timeout: 10000 });

    // "Kütüphaneye ekle" butonu bul ve tıkla
    const addBtn = page.locator('button:has-text("Kütüphaneye ekle"), button:has-text("İzleme listesi"), button:has-text("Ekle")').first();
    if (await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(500);
      // Modal veya dropdown açılmalı
      await expect(page.locator('text="İzledim", text="İzliyorum", text="İzleyeceğim"').first()).toBeVisible({ timeout: 3000 });
      await page.click('text="İzledim"');
      await page.waitForTimeout(500);
    }

    // Kütüphane sayfasında görünmeli
    await page.goto("/library");
    await expect(page.locator('a[href^="/title/"]').first()).toBeVisible({ timeout: 10000 });
  });

  test("Kütüphane sayfasında puanlama güncelleme", async ({ page }) => {
    await page.goto("/library");
    await expect(page.locator('a[href^="/title/"]').first()).toBeVisible({ timeout: 10000 });

    // İlk kartın puanlama butonunu bul
    const firstCard = page.locator('a[href^="/title/"]').first();
    const ratingBtn = firstCard.locator('button[aria-label*="puan"], button:has-text("Puanla")').first();
    if (await ratingBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await ratingBtn.click();
      await page.waitForTimeout(300);
      await expect(page.locator('button:has-text("8"), button:has-text("9"), button:has-text("10")').first()).toBeVisible();
      await page.click('button:has-text("9")');
      await page.waitForTimeout(500);
    }
  });
});