/**
 * Titles.overview (EN) -> TR'ye çevirir (Ollama llama3.2)
 * SADECE overview'i olmayan veya zaten TR olanlar atlanır.
 *   node --env-file=.env scripts/translate-overviews.mjs --apply
 */
import Database from "better-sqlite3";

const APPLY = process.argv.includes("--apply");
const OLLAMA_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2";

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
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        options: { temperature: 0.2, top_p: 0.9 },
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const tr = (data.response ?? "").trim();
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
  await new Promise((r) => setTimeout(r, 500)); // Ollama yavaşlamasin
}

console.log(
  APPLY
    ? `Bitti: ${translated} çevrildi, ${skipped} atlandı (zaten TR), ${failed} hata.`
    : `Dry-run: ${translated} çevrilebilir, ${skipped} atlanacak, ${failed} hata riski.`
);
db.close();