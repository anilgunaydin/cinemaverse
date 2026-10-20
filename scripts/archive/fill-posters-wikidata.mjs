/**
 * Poster'siz nap/serie yampimlarin posterini Wikidata P18 (commons) ile doldurur.
 * SADECE poster_url IS NULL alanlari yazilir; mevcut degerler korunur.
 *
 *   node scripts/fill-posters-wikidata.mjs            # dry-run
 *   node scripts/fill-posters-wikidata.mjs --apply
 */
import Database from "better-sqlite3";

const APPLY = process.argv.includes("--apply");
const db = new Database("data/cinemaverse.db");
db.pragma("journal_mode = WAL");
const nowIso = () => new Date().toISOString();

const targets = db
  .prepare(
    `SELECT id, wikidata_id, COALESCE(localized_title, original_title) AS name FROM titles
     WHERE (poster_url IS NULL OR poster_url = '')
       AND kind IN ('movie', 'series')
       AND wikidata_id IS NOT NULL
     LIMIT 60`
  )
  .all();

console.log("Aday (poster'siz, wikidata'li):", targets.length);

const wdApi = "https://www.wikidata.org/w/api.php";
let filled = 0;
let miss = 0;

for (const t of targets) {
  const url = `${wdApi}?action=wbgetclaims&format=json&origin=*&property=P18&entity=${t.wikidata_id}`;
  let p18 = null;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "CinemaVerse-local-demo/1.0" } });
    if (res.ok) {
      const body = await res.json();
      const claims = body?.claims?.P18;
      const first = claims?.[0]?.mainsnak?.datavalue?.value;
      if (typeof first === "string") p18 = first;
    }
  } catch {
    p18 = null;
  }

  if (p18) {
    // Special:FilePath 600px thumb, commons burgdan direkt resim verir
    const poster = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(
      p18
    )}?width=600`;
    console.log(" +", t.name, "<-", p18.slice(0, 50));
    if (APPLY) {
      db.prepare(
        "UPDATE titles SET poster_url = ?, updated_at = ? WHERE id = ? AND (poster_url IS NULL OR poster_url = '')"
      ).run(poster, nowIso(), t.id);
    }
    filled += 1;
  } else {
    miss += 1;
  }
  await new Promise((r) => setTimeout(r, 700));
}

console.log(
  APPLY
    ? `Bitti: ${filled} poster dolduruldu, ${miss} bulunamadi.`
    : `Dry-run: ${filled} doldurulabilir, ${miss} bulunamadi.`
);
db.close();
