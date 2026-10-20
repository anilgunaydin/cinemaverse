/**
 * Poster'siz yapiimlarin posterini Wikidata QID -> en wiki sayfa ->
 * Wikipedia REST summary gorseli zinciriyle doldurur.
 * SADECE poster_url IS NULL alanlari yazilir; mevcut degerler korunur.
 *
 *   node scripts/fill-posters-wikipedia.mjs            # dry-run
 *   node scripts/fill-posters-wikipedia.mjs --apply
 */
import Database from "better-sqlite3";

const APPLY = process.argv.includes("--apply");
const db = new Database("data/cinemaverse.db");
db.pragma("journal_mode = WAL");
const nowIso = () => new Date().toISOString();

const targets = db
  .prepare(
    `SELECT id, wikidata_id, COALESCE(localized_title, original_title) AS name
     FROM titles
     WHERE (poster_url IS NULL OR poster_url = '')
       AND kind IN ('movie', 'series')
       AND wikidata_id IS NOT NULL`
  )
  .all();

console.log("Aday (poster'siz, wikidata'li):", targets.length);

/* 1) QID'leri 50'lik paketlerle enwiki sitelinklerine cevir */
async function sitelinks(qids) {
  const url =
    `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json` +
    `&props=sitelinks&sitefilter=enwiki&ids=${qids.join("|")}`;
  const res = await fetch(url, { headers: { "User-Agent": "CinemaVerse-local/1.0" } });
  if (!res.ok) return { error: res.status, map: {} };
  const body = await res.json();
  const map = {};
  for (const [qid, ent] of Object.entries(body.entities ?? {})) {
    const title = ent.sitelinks?.enwiki?.title;
    if (title) map[qid] = title;
  }
  return { error: null, map };
}

const qidToPage = {};
for (let i = 0; i < targets.length; i += 40) {
  const chunk = targets.slice(i, i + 40);
  const { error, map } = await sitelinks(chunk.map((t) => t.wikidata_id));
  if (error) {
    console.log("Sitelink hatasi:", error);
    break;
  }
  Object.assign(qidToPage, map);
  await new Promise((r) => setTimeout(r, 500));
}
console.log("enwiki sayfasi bulundu:", Object.keys(qidToPage).length);

/* 2) Her sayfa icin REST summary -> gorsel */
let filled = 0;
let miss = 0;
try {
  for (const t of targets) {
    if (t.poster_url) continue;
    const page = qidToPage[t.wikidata_id];
    if (!page) {
      miss += 1;
      continue;
    }
    const slug = encodeURIComponent(page.replace(/ /g, "_"));
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`, {
      headers: { "User-Agent": "CinemaVerse-local/1.0" },
    });
    if (!res.ok) {
      miss += 1;
      await new Promise((r) => setTimeout(r, 350));
      continue;
    }
    const body = await res.json();
    let img = body.originalimage?.source ?? body.thumbnail?.source ?? null;
    if (img) {
      // thumbnail geliyorsa 600px'e yukselt (commons thumb genisletmesi)
      img = img.replace(/\/(\d+)px-/, "/600px-");
    } else {
      miss += 1;
      await new Promise((r) => setTimeout(r, 350));
      continue;
    }
    console.log(" +", (t.name ?? "?").slice(0, 40), "<-", img.slice(0, 70));
    if (APPLY) {
      db.prepare(
        "UPDATE titles SET poster_url = ?, updated_at = ? WHERE id = ? AND (poster_url IS NULL OR poster_url = '')"
      ).run(img, nowIso(), t.id);
    }
    filled += 1;
    await new Promise((r) => setTimeout(r, 350));
  }
} finally {
  console.log(
    APPLY
      ? `Bitti: ${filled} poster dolduruldu, ${miss} bulunamadi.`
      : `Dry-run: ${filled} doldurulabilir, ${miss} bulunamadi.`
  );
  db.close();
}
