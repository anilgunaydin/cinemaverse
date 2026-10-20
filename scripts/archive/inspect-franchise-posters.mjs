import Database from "better-sqlite3";
const db = new Database("data/cinemaverse.db", { readonly: true });
const rows = db
  .prepare(
    `SELECT f.name fr, t.localized_title ad, t.release_year yil,
            (t.poster_url IS NOT NULL AND t.poster_url <> '') poster
     FROM franchise_titles ft
     JOIN franchises f ON f.id = ft.franchise_id
     JOIN titles t ON t.id = ft.title_id
     ORDER BY f.name, t.release_year`
  )
  .all();
for (const r of rows)
  console.log(`${r.fr} | ${r.ad} (${r.yil}) | poster: ${r.poster ? "VAR" : "YOK"}`);
db.close();
