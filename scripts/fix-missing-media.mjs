/**
 * Eksik poster/backdrop/puan olan yapimlari TMDb'den tamamlar.
 *   node --env-file=.env scripts/fix-missing-media.mjs --apply
 */
import Database from "better-sqlite3";

const APPLY = process.argv.includes("--apply");
const KEY = process.env.TMDB_API_KEY ?? "";
if (!KEY) {
  console.log("TMDB_API_KEY yok.");
  process.exit(1);
}

const db = new Database("data/cinemaverse.db");
db.pragma("journal_mode = WAL");
const now = new Date().toISOString();

async function tmdb(path) {
  const sep = path.includes("?") ? "&" : "?";
  const url = `https://api.themoviedb.org/3${path}${sep}api_key=${KEY}`;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 8000 * attempt));
        continue;
      }
      return null;
    } catch {
      if (attempt === 4) return null;
      await new Promise((r) => setTimeout(r, 4000 * attempt));
    }
  }
  return null;
}

const rows = db
  .prepare(
    `SELECT id, kind, original_title, localized_title, release_year, imdb_id, tmdb_id,
            poster_url, backdrop_url, external_rating
     FROM titles
     WHERE kind IN ('movie','series')
       AND (poster_url IS NULL OR poster_url = ''
            OR backdrop_url IS NULL OR backdrop_url = ''
            OR external_rating IS NULL)`
  )
  .all();

console.log("Eksik alani olan yapim:", rows.length);

const upd = db.prepare(
  `UPDATE titles
   SET poster_url = COALESCE(NULLIF(?, ''), poster_url),
       backdrop_url = COALESCE(NULLIF(?, ''), backdrop_url),
       external_rating = COALESCE(?, external_rating),
       external_rating_count = COALESCE(external_rating_count, ?),
       external_rating_source = COALESCE(external_rating_source, 'tmdb'),
       tmdb_id = COALESCE(tmdb_id, ?),
       updated_at = ?
   WHERE id = ?`
);

let fixed = 0;
for (const t of rows) {
  const media = t.kind === "movie" ? "movie" : "tv";
  let tmdbId = t.tmdb_id;

  if (!tmdbId && t.imdb_id) {
    const found = await tmdb(`/find/${t.imdb_id}?external_source=imdb_id`);
    const hit =
      media === "movie" ? found?.movie_results?.[0] : found?.tv_results?.[0];
    if (hit) tmdbId = hit.id;
  }

  if (!tmdbId) {
    // Yil eslesmesi gevsek: ayni isimdeki ilk sonucu dene
    const query = encodeURIComponent(t.original_title ?? t.localized_title ?? "");
    const search = await tmdb(
      `/search/${media}?query=${query}&include_adult=false`
    );
    const candidates = search?.results ?? [];
    const exact = candidates.find(
      (c) => c.title === t.original_title || c.name === t.original_title
    );
    const first = exact ?? candidates[0];
    if (first) tmdbId = first.id;
  }

  if (!tmdbId) {
    console.log("  ! TMDB id bulunamadi:", t.original_title);
    continue;
  }

  const detail = await tmdb(`/${media}/${tmdbId}?append_to_response=images`);
  if (!detail) {
    console.log("  ! Detay alinamadi:", t.original_title);
    continue;
  }

  const posterPath = detail.poster_path
    ? `https://image.tmdb.org/t/p/w500${detail.poster_path}`
    : "";
  const backdropPath = detail.backdrop_path
    ? `https://image.tmdb.org/t/p/w780${detail.backdrop_path}`
    : "";
  const rating =
    typeof detail.vote_average === "number" ? detail.vote_average : null;
  const voteCount = detail.vote_count ?? null;

  console.log(
    `  + ${t.original_title} | poster=${posterPath ? "var" : "yok"} | backdrop=${backdropPath ? "var" : "yok"} | puan=${rating ?? "-"}`
  );

  if (APPLY) {
    upd.run(
      posterPath,
      backdropPath,
      rating,
      voteCount,
      String(tmdbId),
      now,
      t.id
    );
    fixed += 1;
  }

  await new Promise((r) => setTimeout(r, 400));
}

console.log(APPLY ? `Bitti: ${fixed} yapim tamamlandi.` : "Dry-run.");
db.close();