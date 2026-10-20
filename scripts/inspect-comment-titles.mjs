import Database from "better-sqlite3";
const db = new Database("data/cinemaverse.db", { readonly: true });
const rows = db
  .prepare(
    `SELECT t.id, COALESCE(t.localized_title, t.original_title) ad, COUNT(*) c
     FROM external_comments ec JOIN titles t ON t.id = ec.title_id
     GROUP BY ec.title_id ORDER BY c DESC LIMIT 6`
  )
  .all();
console.log(JSON.stringify(rows, null, 1));
db.close();
