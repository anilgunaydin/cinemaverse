import Database from "better-sqlite3";
const db = new Database("data/cinemaverse.db", { readonly: true });
console.log(
  "fragmanli yapim:",
  db.prepare("SELECT COUNT(*) c FROM titles WHERE trailer_url IS NOT NULL AND trailer_url <> ''").get().c
);
console.log(
  "yorum:",
  db.prepare("SELECT COUNT(*) c FROM external_comments").get().c
);
const sample = db
  .prepare(
    `SELECT COALESCE(localized_title, original_title) ad, trailer_url
     FROM titles WHERE kind = 'series' AND trailer_url <> '' LIMIT 3`
  )
  .all();
console.log(JSON.stringify(sample, null, 1));
db.close();
