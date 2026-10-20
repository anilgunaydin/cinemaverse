/**
 * TMDb'den yatay (16:9) backdrop gostemlerielr tutucu titles.backdrop_url
 * doldurur (SADECE NULL hallerini; mevcut deger korunur).
 *
 *   node --env-file=.env scripts/fetch-backdrops-tmdb.mjs            # dry-run
 *   node --env-file=.env scripts/fetch-backdrops-tmdb.mjs --apply
 */
import Database from "better-sqlite3";

const APPLY = process.argv.includes("--apply");
const KEY = process.env.TMDB_API_KEY ?? "";
if (!KEY) {
  console.log("TMDB_API_KEY yok (.env satirini kontrol et).");
  process.exit(1);
}

const db = new Database("data/cinemaverse.db");
db.pragma("journal_mode = WAL");
const nowIso = () => new Date().toISOString();

const titles = db
  .prepare(
    `SELECT t.id, t.kind, t.original_title AS orijinal, t.localized_title AS yerel,
            t.release_year AS yil, t.imdb_id
     FROM titles t
     WHERE t.kind IN ('movie', 'series')
       AND (t.backdrop_url IS NULL OR t.backdrop_url = '')
     ORDER BY t.id`
  )
  .all();
console.log("Aday yapim:", titles.length);

const BASE = "https://api.themoviedb.org/3";
const PARAMS = `api_key=${KEY}`;

async function tmdb(path, extra = "") {
  const url = `${BASE}${path}?${PARAMS}${extra ? "&" + extra : ""}`;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return { status: 200, body: await res.json() };
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 8000 * attempt));
        continue;
      }
      return { status: res.status, body: null };
    } catch {
      if (attempt === 4) return { status: 0, body: null };
      await new Promise((r) => setTimeout(r, 4000 * attempt));
    }
  }
  return { status: 0, body: null };
}

function yearOf(dateStr) {
  return dateStr ? Number(dateStr.slice(0, 4)) : null;
}

async function findTmdbId(t, tmdbMedia) {
  if (tmdbMedia === "movie" && t.imdb_id) {
    const { body } = await tmdb(`/find/${t.imdb_id}`, "external_source=imdb_id");
    const viaImdb = body?.movie_results?.[0] ?? null;
    if (viaImdb) return viaImdb;
  }
  const query = encodeURIComponent(t.orijinal ?? t.yerel ?? "");
  const year = t.yil ?? "";
  const extra = `query=${query}` + (year ? (tmdbMedia === "movie" ? `&year=${year}` : `&first_air_date_year=${year}`) : "");
  const { body } = await tmdb(`/search/${tmdbMedia}`, extra);
  const results = body?.results ?? [];
  for (const r of results.slice(0, 3)) {
    const resultYear = yearOf(r.release_date ?? r.first_air_date ?? null);
    if (t.yil == null || resultYear == null) return r;
    if (Math.abs(resultYear - t.yil) <= 1) return r;
  }
  return results[0] ?? null;
}

const update = db.prepare(
  "UPDATE titles SET backdrop_url = ?, updated_at = ? WHERE id = ? AND (backdrop_url IS NULL OR backdrop_url = '')"
);

let found = 0;
let missing = 0;

for (const t of titles) {
  const media = t.kind === "movie" ? "movie" : "tv";
  const match = await findTmdbId(t, media);
  const backdropPath = match?.backdrop_path ?? null;
  if (backdropPath) {
    const url = `https://image.tmdb.org/t/p/w780${backdropPath}`;
    console.log(" +", (t.yerel ?? t.orijinal ?? "?").slice(0, 38), "->", backdropPath.slice(-40));
    if (APPLY) update.run(url, nowIso(), t.id);
    found += 1;
  } else {
    missing += 1;
  }
  await new Promise((r) => setTimeout(r, 250));
}

console.log(
  APPLY
    ? `Bitti: ${found} backdrop eklendi, ${missing} bulunamadi.`
    : `Dry-run: ${found} backdrop bulunabilir, ${missing} bulunamadi.`
);
db.close();
