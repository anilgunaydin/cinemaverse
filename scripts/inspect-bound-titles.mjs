/**
 * Franchise baglamalarindaki title'larin wikidata kimliklerini
 * gercek etiketleriyle karsilastirir; yalniz rapor uretir (yazmaz).
 */
import Database from "better-sqlite3";

const db = new Database("data/cinemaverse.db", { readonly: true });

const rows = db
  .prepare(
    `SELECT f.name AS franchise, f.wikidata_id AS fr_wd, t.id AS title_id, t.wikidata_id AS t_wd,
            t.localized_title, t.original_title, t.release_year, t.kind
     FROM franchise_titles ft
     JOIN franchises f ON f.id = ft.franchise_id
     JOIN titles t ON t.id = ft.title_id
     ORDER BY f.name, t.release_year`
  )
  .all();

for (const r of rows) {
  console.log(
    JSON.stringify({
      franchise: r.franchise,
      fr_wd: r.fr_wd,
      t_wd: r.t_wd,
      ad: r.localized_title || r.original_title,
      yil: r.release_year,
      kind: r.kind,
      title_id: r.title_id,
    })
  );
}

// Baglamali title'larin kutuphane/inceleme/liste referansi var mi?
const refs = db
  .prepare(
    `SELECT t.id,
       (SELECT COUNT(*) FROM library_entries le WHERE le.title_id = t.id) AS lib,
       (SELECT COUNT(*) FROM reviews rv WHERE rv.title_id = t.id) AS rev,
       (SELECT COUNT(*) FROM user_list_items li WHERE li.title_id = t.id) AS lst,
       (SELECT COUNT(*) FROM discussion_threads dt WHERE dt.title_id = t.id) AS thr
     FROM franchise_titles ft JOIN titles t ON t.id = ft.title_id`
  )
  .all();
console.log("\n-- referanslar --");
for (const x of refs) {
  if (x.lib || x.rev || x.lst || x.thr) {
    console.log("REFERANSLI:", x.id, "lib:", x.lib, "rev:", x.rev, "lst:", x.lst, "thr:", x.thr);
  } else {
    console.log("serbest:", x.id);
  }
}
db.close();
