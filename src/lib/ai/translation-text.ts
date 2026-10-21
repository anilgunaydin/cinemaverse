/**
 * Ceviri metnini temizleyen saf yardimcilar (ag/DB erisimi yok, test edilebilir).
 */

/**
 * Modelin dondurdugu metni kullaniciya gosterilebilir hale getirir:
 * - bastaki "Çeviri:" / "Translation:" gibi etiketleri atar
 * - tum metni saran tirnaklari atar
 */
export function cleanTranslation(raw: string): string {
  let text = raw.trim();

  // "Çeviri:" / "Translation:" gibi onekleri at.
  text = text.replace(
    /^(?:çeviri|ceviri|translation|türkçe|turkce)\s*[:\-–]\s*/i,
    "",
  );
  // Tum metni saran tirnaklari at.
  text = text.replace(/^["“'«]+/, "").replace(/["”'»]+$/, "");
  return text.trim();
}
