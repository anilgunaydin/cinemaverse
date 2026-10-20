import Database from "better-sqlite3";
const db = new Database("data/cinemaverse.db", { readonly: true });

console.log("== Franchise'ler ==");
for (const f of db.prepare("SELECT id, name, wikidata_id FROM franchises").all()) {
  console.log("-", f.name, "| wd:", f.wikidata_id);
}

console.log("\n== ')[Hobbit/LOTR/HP] sığan başlıklar ==");
const rows = db
  .prepare(
    `SELECT id, kind, localized_title, original_title, release_year FROM titles
     WHERE lower(COALESCE(localized_title, original_title)) LIKE '%hobbit%'
        OR lower(COALESCE(localized_title, original_title)) LIKE '%lord of the rings%'
        OR lower(COALESCE(localized_title, original_title)) LIKE '%yüzüklerin%'
        OR lower(COALESCE(localized_title, original_title)) LIKE '%harry potter%'
        OR lower(COALESCE(localized_title, original_title)) LIKE '%fellowship%'
        OR lower(COALESCE(localized_title, original_title)) LIKE '%ring%'
     LIMIT 30`
  )
  .all();
for (const r of rows)
  console.log("-", r.kind, "|", r.localized_title || r.original_title, "|", r.release_year);
db.close();
