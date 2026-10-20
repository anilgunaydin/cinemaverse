import Database from "better-sqlite3";

const db = new Database("./data/cinemaverse.db", { readonly: true });
const title = db
  .prepare(
    `select id, kind, original_title, localized_title, release_year, runtime_minutes,
            overview, imdb_id, wikidata_id, metadata_provider, metadata_verified
     from titles order by created_at desc limit 3`,
  )
  .all();
console.log("TITLES:", JSON.stringify(title, null, 1));

for (const row of title) {
  const genres = db
    .prepare(
      `select g.name_tr from title_genres tg join genres g on g.id = tg.genre_id where tg.title_id = ?`,
    )
    .all(row.id);
  const credits = db
    .prepare(
      `select p.name, c.role, c.character_name from credits c join people p on p.id = c.person_id where c.title_id = ? limit 8`,
    )
    .all(row.id);
  console.log(`\n${row.original_title}:`);
  console.log("  genres:", genres.map((g) => g.name_tr).join(", "));
  console.log("  credits:", credits.map((c) => `${c.name} (${c.role})`).join(", "));
}
