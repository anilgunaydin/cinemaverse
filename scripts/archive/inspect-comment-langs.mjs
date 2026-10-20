import Database from "better-sqlite3";
const db = new Database("data/cinemaverse.db", { readonly: true });
const rows = db
  .prepare(
    `SELECT t.id, COALESCE(t.localized_title, t.original_title) ad,
            SUM(CASE WHEN ec.language = 'tr' THEN 1 ELSE 0 END) tr,
            SUM(CASE WHEN ec.language = 'en' THEN 1 ELSE 0 END) en
     FROM external_comments ec JOIN titles t ON t.id = ec.title_id
     GROUP BY ec.title_id
     HAVING tr > 0 AND en > 0
     ORDER BY tr + en DESC LIMIT 5`
  )
  .all();
console.log(JSON.stringify(rows, null, 1));
db.close();
