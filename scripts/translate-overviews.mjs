/**
 * Titles.overview (EN) -> TR'ye çevirir (Google Gemini).
 * Yerel model çalıştırmaz; GEMINI_API_KEY gerekir.
 *   node --env-file=.env scripts/translate-overviews.mjs --apply
 */
import Database from "better-sqlite3";

const APPLY = process.argv.includes("--apply");
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

if (!GEMINI_KEY) {
  console.error("GEMINI_API_KEY tanimli degil. .env dosyasina ekleyin.");
  process.exit(1);
}

const db = new Database("data/cinemaverse.db");
db.pragma("journal_mode = WAL");
const nowIso = () => new Date().toISOString();

/* Sadece overview bos veya boşlugu varsa C EVREN - ama TR karakter icerenleri atla */
const candidates = db
  .prepare(`
    SELECT id, original_title, localized_title, overview, original_language
    FROM titles
    WHERE kind IN ('movie','series')
      AND overview IS NOT NULL AND overview != ''
      AND original_language != 'tr'
  `)
  .all();

console.log("Aday (EN overview):", candidates.length);

function looksTurkish(text) {
  const trChars = /[çğıöşüÇĞIİÖŞÜ]/;
  return trChars.test(text);
}

const upd = db.prepare("UPDATE titles SET overview = ?, updated_at = ? WHERE id = ? AND overview IS NOT NULL");

let translated = 0, skipped = 0, failed = 0;

for (const t of candidates) {
  if (looksTurkish(t.overview)) {
    skipped += 1;
    continue;
  }
  const prompt = `Translate this movie/series overview to Turkish. Keep it natural, fluent Turkish. No extra commentary, just the translation.\n\nOverview: ${t.overview}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/` +
        `${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=` +
        `${encodeURIComponent(GEMINI_KEY)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
        }),
      },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const tr = (data.candidates?.[0]?.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("")
      .trim();
    if (tr && tr.length > 10 && !looksTurkish(t.overview)) {
      console.log(" +", (t.localized_title ?? t.original_title ?? "?").slice(0, 38));
      if (APPLY) upd.run(tr, nowIso(), t.id);
      translated += 1;
    } else {
      failed += 1;
    }
  } catch (e) {
    console.log(" ! hata:", e.message);
    failed += 1;
  }
  await new Promise((r) => setTimeout(r, 1200)); // ucretsiz kota icin nazik bekleme
}

console.log(
  APPLY
    ? `Bitti: ${translated} çevrildi, ${skipped} atlandı (zaten TR), ${failed} hata.`
    : `Dry-run: ${translated} çevrilebilir, ${skipped} atlanacak, ${failed} hata riski.`
);
db.close();