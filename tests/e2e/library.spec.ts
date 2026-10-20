import { test, expect } from "@playwright/test";

/** "Kişisel hafızanız" basligini iceren en ic panel */
const memoryPanel = (page: any) =>
  page.locator('section:has(h2:text-is("Kişisel hafızanız"))').first();

test.describe("Kütüphane - Ekle/Puanla", () => {
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

  test("Kişisel hafıza panelinde durum ve puan kontrolleri var", async ({ page }) => {
    const panel = memoryPanel(page);
    await expect(panel).toBeVisible();

    // Durum rozetleri
    await expect(panel.locator('button:has-text("İzledim")')).toBeVisible();
    await expect(panel.locator('button:has-text("İzliyorum")')).toBeVisible();
    await expect(panel.locator('button:has-text("Listemde")')).toBeVisible();

    // Puan butonlari (1-10)
    await expect(panel.locator('button[aria-label$="puan"]')).toHaveCount(10);
  });

  test("Puanlama yapılabilir ve kaydedilir", async ({ page }) => {
    const panel = memoryPanel(page);
    await expect(panel).toBeVisible();

    // 10 puan: basil ve durum degissin
    const r10 = panel.locator('button[aria-label="10 puan"]');
    const before = await r10.getAttribute("aria-pressed");
    await r10.click();
    await expect(r10).not.toHaveAttribute("aria-pressed", before ?? "false", {
      timeout: 5000,
    });

    // Kaydet
    const saveBtn = panel
      .locator('button:has-text("Kaydet"), button:has-text("Kütüphaneye ekle")')
      .first();
    await saveBtn.click();

    // Basari mesaji
    await expect(panel.locator('text=Kaydedildi')).toBeVisible({
      timeout: 15000,
    });
  });

  test("Durum değiştirilebilir", async ({ page }) => {
    const panel = memoryPanel(page);
    const statusBtn = panel.locator('button:has-text("İzliyorum")');
    const before = await statusBtn.getAttribute("aria-pressed");
    await statusBtn.click();
    await expect(statusBtn).not.toHaveAttribute("aria-pressed", before ?? "false", {
      timeout: 5000,
    });
  });

  test("Detaylar açılıp kapatılabilir", async ({ page }) => {
    const panel = memoryPanel(page);
    const notes = panel.locator("#notes");
    await expect(notes).toBeHidden();

    await panel.locator('button:has-text("Detay ekle")').click();
    await expect(notes).toBeVisible();
    await expect(panel.locator("#liked")).toBeVisible();

    await panel.locator('button:has-text("Detayları gizle")').click();
    await expect(notes).toBeHidden();
  });
});