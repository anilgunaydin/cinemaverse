import Database from "better-sqlite3";
const db = new Database("data/cinemaverse.db", { readonly: true });

const anil = db.prepare("SELECT id FROM users WHERE email = ?").get("anil@cinemaverse.local");

const gap = db
  .prepare(
    `SELECT t.id, t.localized_title, t.original_title, t.kind, t.wikidata_id, t.tvmaze_id, t.imdb_id
     FROM library_entries le JOIN titles t ON t.id = le.title_id
     WHERE le.user_id = ? AND (t.poster_url IS NULL OR t.poster_url = '')`
  )
  .all(anil.id);

console.log("Anil'da cardsiz kalan kayit:", gap.length);
const withWd = gap.filter((g) => g.wikidata_id).length;
const withTvm = gap.filter((g) => g.tvmaze_id).length;
const withImdb = gap.filter((g) => g.imdb_id).length;
console.log(`  wikidata: ${withWd}, tvmaze_id: ${withTvm}, imdb: ${withImdb}`);
for (const g of gap.slice(0, 12)) {
  console.log(" -", g.kind, "|", g.localized_title || g.original_title, "| wd:", g.wikidata_id, "| tvm:", g.tvmaze_id);
}
db.close();
