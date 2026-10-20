import Database from "better-sqlite3";
const db = new Database("./data/cinemaverse.db", { readonly: true });
const series = db.prepare("select id, original_title, kind, external_rating, external_rating_source from titles where kind='series' limit 3").all();
console.log("SERIES:", series);
for (const s of series) {
  const seasons = db.prepare("select season_number, original_title, release_year from titles where parent_id=? order by season_number").all(s.id);
  const credits = db.prepare("select role, count(*) c from credits where title_id=? group by role").all(s.id);
  console.log(`\n${s.original_title}: ${seasons.length} sezon`);
  console.log("  sezonlar:", seasons.map(x => `S${x.season_number} (${x.release_year})`).join(", "));
  console.log("  ekip:", credits.map(c => `${c.role}=${c.c}`).join(", "));
}
console.log("\nToplam titles:", db.prepare("select kind, count(*) c from titles group by kind").all());
