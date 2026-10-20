import Database from "better-sqlite3";
const db = new Database("data/cinemaverse.db", { readonly: true });

console.log("== Poster'siz yapimlar ==");
const rows = db
  .prepare(
    "SELECT id, localized_title, kind, release_year, parent_id FROM titles WHERE (poster_url IS NULL OR poster_url = '') ORDER BY localized_title"
  )
  .all();
console.log("total:", rows.length);
for (const r of rows.slice(0, 20)) {
  console.log(" -", r.kind, "|", r.localized_title, "|", r.release_year, "| parent:", r.parent_id);
}

console.log("\n== Kacisinde ona ait yapiim POSTERLI mi (kitapli)? ==");
const anil = db.prepare("SELECT id FROM users WHERE email = ?").get("anil@cinemaverse.local");
const noPosterInLib = db
  .prepare(
    `SELECT COUNT(*) c FROM library_entries le JOIN titles t ON t.id = le.title_id
     WHERE le.user_id = ? AND (t.poster_url IS NULL OR t.poster_url = '')`
  )
  .get(anil.id).c;
const inLib = db.prepare("SELECT COUNT(*) c FROM library_entries WHERE user_id = ?").get(anil.id).c;
console.log(`Anil'in kayitlari: ${inLib}, poster'siz: ${noPosterInLib}`);
db.close();
