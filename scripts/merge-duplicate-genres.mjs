/**
 * Ayni turu iki kez tutan kayitlari birlestirir
 * (or. "Drama Film" + "drama film", "Horror Film" + "Korku").
 *
 *   node scripts/merge-duplicate-genres.mjs            # dry-run
 *   node scripts/merge-duplicate-genres.mjs --apply    # yaz
 *
 * Eslesme: name_en normalize edilir ("film"/"films" atilir, kucuk harf).
 * Ayni anahtara dusen turlerden en cok baglantisi olan tutulur; digerlerinin
 * title_genres baglantilari ona tasinir ve kopya tur silinir.
 */
import Database from "better-sqlite3";

const APPLY = process.argv.includes("--apply");
const db = new Database("data/cinemaverse.db");
db.pragma("journal_mode = WAL");

function normalize(value) {
  return value
    .toLocaleLowerCase("tr")
    .replace(/\bfilms?\b/g, " ")
    .replace(/[^a-z0-9ğüşıöç]+/g, " ")
    .trim();
}

const rows = db
  .prepare(
    `select g.id, g.slug, g.name_tr, g.name_en, count(tg.title_id) as links
     from genres g left join title_genres tg on tg.genre_id = g.id
     group by g.id`,
  )
  .all();

const groups = new Map();
for (const row of rows) {
  const key = normalize(row.name_en);
  if (!key) continue;
  const list = groups.get(key) ?? [];
  list.push(row);
  groups.set(key, list);
}

const duplicates = [...groups.values()].filter((list) => list.length > 1);
console.log("Kopya tur grubu:", duplicates.length);
if (duplicates.length === 0) process.exit(0);

const insert = db.prepare(
  `insert or ignore into title_genres (title_id, genre_id, provider)
   select title_id, ?, provider from title_genres where genre_id = ?`,
);
const cleanup = db.prepare(
  `delete from title_genres where genre_id = ?
   and exists (
     select 1 from title_genres keep
     where keep.genre_id = ? and keep.title_id = title_genres.title_id
   )`,
);
const moveRest = db.prepare(
  "update title_genres set genre_id = ? where genre_id = ?",
);
const remove = db.prepare("delete from genres where id = ?");

let merged = 0;
db.transaction(() => {
  for (const list of duplicates) {
    const [keep, ...rest] = [...list].sort(
      (a, b) => a.slug.length - b.slug.length || b.links - a.links,
    );
    for (const duplicate of rest) {
      console.log(
        ` + ${duplicate.name_tr} (${duplicate.slug}, ${duplicate.links}) -> ${keep.name_tr} (${keep.slug}, ${keep.links})`,
      );
      if (!APPLY) continue;
      // Once baglantilari tasi (cakisanlar insert-or-ignore ile atlanir),
      // sonra kopya turun kalan baglantilarini sil ve turu kaldir.
      insert.run(keep.id, duplicate.id);
      cleanup.run(duplicate.id, keep.id);
      moveRest.run(keep.id, duplicate.id);
      remove.run(duplicate.id);
      merged += 1;
    }
  }
})();

console.log(
  APPLY
    ? `Bitti: ${merged} kopya tur birlestirildi.`
    : `Dry-run: ${merged} kopya tur birlestirilebilir.`,
);
db.close();
