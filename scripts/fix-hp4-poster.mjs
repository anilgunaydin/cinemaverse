/** HP4 (Ateş Kadehi) film posterini tek hedefli doldurur (roman entity'sinde poster yoktu). */
import Database from "better-sqlite3";
const db = new Database("data/cinemaverse.db");
db.pragma("journal_mode = WAL");

const poster =
  "https://upload.wikimedia.org/wikipedia/en/c/c9/Harry_Potter_and_the_Goblet_of_Fire_Poster.jpg";

const info = db
  .prepare(
    "UPDATE titles SET poster_url = ?, updated_at = ? WHERE wikidata_id = 'Q102225' AND (poster_url IS NULL OR poster_url = '')"
  )
  .run(poster, new Date().toISOString());
console.log("Guncellenen satir:", info.changes);
db.close();
