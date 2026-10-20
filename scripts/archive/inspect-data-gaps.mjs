import Database from "better-sqlite3";
const db = new Database("data/cinemaverse.db", { readonly: true });

function c(sql) {
  return db.prepare(sql).get().c;
}
function c2(sql) {
  return db.prepare(sql).get();
}

const anonil = db
  .prepare("SELECT id FROM users WHERE email = ?")
  .get("anil@cinemaverse.local");

console.log("== Tablo durumu ==");
console.log("users:", c("SELECT COUNT(*) c FROM users"));
console.log("titles:", c("SELECT COUNT(*) c FROM titles"));
console.log("titles poster NULL:", c("SELECT COUNT(*) c FROM titles WHERE poster_url IS NULL OR poster_url = ''"));
console.log("titles without media (poster+backdrop):", c("SELECT COUNT(*) c FROM titles WHERE (poster_url IS NULL OR poster_url = '') AND (backdrop_url IS NULL OR backdrop_url = '')"));
console.log("library_entries:", c("SELECT COUNT(*) c FROM library_entries"),
  "| of them Anil's:", anonil ? c2(`SELECT COUNT(*) c FROM library_entries WHERE user_id = '${anonil.id}'`).c : 0);
console.log("reviews:", c("SELECT COUNT(*) c FROM reviews"));
console.log("discussion_threads:", c("SELECT COUNT(*) c FROM discussion_threads"));
console.log("discussion_posts:", c("SELECT COUNT(*) c FROM discussion_posts"));
console.log("user_lists:", c("SELECT COUNT(*) c FROM user_lists"));
console.log("user_list_items:", c("SELECT COUNT(*) c FROM user_list_items"));
console.log("follows:", c("SELECT COUNT(*) c FROM follows"));
console.log("franchises:", c("SELECT COUNT(*) c FROM franchises"));
console.log("franchise_titles:", c("SELECT COUNT(*) c FROM franchise_titles"));

console.log("\n== PostgreSQL tankari posteri BAHSIYET olmayan yapiimlar (8) ==");
const rowsNoPoster = db
  .prepare(
    "SELECT id, name, kind, source_provider FROM titles WHERE poster_url IS NULL OR poster_url = '' LIMIT 8"
  )
  .all();
for (const r of rowsNoPoster) {
  console.log(" -", r.name, "|", r.kind, "| kaynak:", r.source_provider);
}
console.log("\nPoster elde eden ilk 3:");
for (const r of db.prepare("SELECT name, poster_url FROM titles WHERE poster_url IS NOT NULL AND poster_url != '' LIMIT 3").all()) {
  console.log(" -", r.name, "->", r.poster_url.slice(0, 70));
}
db.close();
