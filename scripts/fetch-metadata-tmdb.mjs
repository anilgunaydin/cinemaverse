/**
 * TMDb metadata zenginlestirmesi (SADECE BOS alanlar; mevcut degerler korunur):
 *  1) external_rating/count/source dolmayan film+ dizilere TMDb puani (kaynak: 'tmdb')
 *  2) genre'siz yapimlara TMDb turleri (slug tabanli esleme)
 *  3) credits'siz yapimlara yonetmen + ilk 8 oyuncu
 *
 *   node --env-file=.env scripts/fetch-metadata-tmdb.mjs            # dry-run
 *   node --env-file=.env scripts/fetch-metadata-tmdb.mjs --apply
 */
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

const APPLY = process.argv.includes("--apply");
const KEY = process.env.TMDB_API_KEY ?? "";
if (!KEY) {
  console.log("TMDB_API_KEY yok (.env satirini kontrol et).");
  process.exit(1);
}

const db = new Database("data/cinemaverse.db");
db.pragma("journal_mode = WAL");
const nowIso = () => new Date().toISOString();
const newId = (p) => `${p}_${randomUUID().replace(/-/g, "").slice(0, 20)}`;

function yearOf(dateStr) {
  return dateStr ? Number(dateStr.slice(0, 4)) : null;
}

async function tmdb(path, extra = "") {
  const url = `https://api.themoviedb.org/3${path}?api_key=${KEY}${extra ? "&" + extra : ""}`;
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

async function findTmdbId(t, media) {
  if (t.imdb_id) {
    const found = await tmdb(`/find/${t.imdb_id}`, "external_source=imdb_id");
    const viaImdb = media === "movie" ? found?.movie_results?.[0] : found?.tv_results?.[0];
    if (viaImdb) return viaImdb;
  }
  const query = encodeURIComponent(t.original_title ?? t.localized_title ?? "");
  const year = t.release_year ?? "";
  const extra = `query=${query}` + (year ? (media === "movie" ? `&year=${year}` : `&first_air_date_year=${year}`) : "");
  const search = await tmdb(`/search/${media}`, extra);
  const results = search?.results ?? [];
  for (const r of results.slice(0, 3)) {
    const ry = yearOf(r.release_date ?? r.first_air_date ?? null);
    if (t.release_year == null || ry == null) return r;
    if (Math.abs(ry - t.release_year) <= 1) return r;
  }
  return results[0] ?? null;
}

/* --- *//* TMDb tur adi -> mevcut genres slug eslemesi (yalniz bilinenler) */
const GENRE_SLUG_MAP = {
  action: "action", adventure: "adventure", animation: null, comedy: "comedy",
  crime: "crime", documentary: null, drama: "drama", family: "family",
  fantasy: "fantasy", history: "history", horror: "horror", music: "music",
  mystery: "mystery", romance: "romance", "science fiction": "science-fiction",
  "tv movie": null, thriller: "thriller", war: "war", western: "western",
  kids: null, reality: null, "sci-fi & fantasy": "science-fiction",
  soap: null, talk: null, "war & politics": "war", "action & adventure": "action",
};

const titles = db
  .prepare(
    `SELECT t.id, t.kind, t.original_title, t.localized_title, t.release_year, t.imdb_id,
            t.external_rating,
            (SELECT COUNT(*) FROM title_genres g WHERE g.title_id = t.id) AS genreCount,
            (SELECT COUNT(*) FROM credits c WHERE c.title_id = t.id) AS creditCount
     FROM titles t
     WHERE t.kind IN ('movie','series')
       AND (t.external_rating IS NULL
            OR EXISTS (SELECT 1 FROM title_genres g2 WHERE g2.title_id = t.id) = 0
            OR EXISTS (SELECT 1 FROM credits c2 WHERE c2.title_id = t.id) = 0)`
  )
  .all();
const needAny = db.prepare(`SELECT COUNT(*) c FROM titles WHERE kind IN ('movie','series') AND external_rating IS NULL`).get().c;
console.log("Puanı eksik yapım:", needAny, "| Bu turda işlenecek:", titles.length);

const updRating = db.prepare(
  "UPDATE titles SET external_rating = ?, external_rating_count = ?, external_rating_source = 'tmdb', updated_at = ? WHERE id = ? AND external_rating IS NULL"
);
const insGenreRow = db.prepare("INSERT OR IGNORE INTO title_genres (title_id, genre_id, provider) VALUES (?, ?, 'tmdb')");
const insPerson = db.prepare(
  "INSERT INTO people (id, name, tmdb_id, created_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING"
);
const findPersonByTmdb = db.prepare("SELECT id FROM people WHERE tmdb_id = ? LIMIT 1");
const findPersonByName = db.prepare("SELECT id FROM people WHERE lower(name) = lower(?) LIMIT 1");
const insCredit = db.prepare(
  "INSERT OR IGNORE INTO credits (id, title_id, person_id, role, character_name, billing_order, provider) VALUES (?, ?, ?, ?, ?, ?, 'tmdb')"
);

let rated = 0, ratedMiss = 0, genreFixed = 0, creditFixed = 0;

for (const t of titles) {
  const media = t.kind === "movie" ? "movie" : "tv";
  const match = await findTmdbId(t, media);
  if (!match?.id) {
    ratedMiss += t.external_rating == null ? 1 : 0;
    continue;
  }
  const detail = await tmdb(`/${media}/${match.id}`, "append_to_response=credits");
  if (!detail) continue;

  /* 1) puan: SADECE bos ise (tvmaze/kaynak degeri korunur) */
  if (t.external_rating == null && typeof detail.vote_average === "number") {
    const rating = Math.round(detail.vote_average * 10) / 10; // TMDb 0-10; esit hassasiyet
    console.log(" + puan:", (t.localized_title ?? t.original_title ?? "?").slice(0, 36), "=", rating, `(${detail.vote_count} oyla)`);
    if (APPLY) updRating.run(rating, detail.vote_count, nowIso(), t.id);
    rated += 1;
  }

  /* 2) turler: sadece hic yoq ise */
  if (t.genreCount === 0 && Array.isArray(detail.genres) && detail.genres.length > 0) {
    for (const g of detail.genres) {
      const slug = GENRE_SLUG_MAP[String(g.name ?? "").toLowerCase()];
      if (!slug) continue;
      const genreRow = db.prepare("SELECT id FROM genres WHERE slug = ?").get(slug);
      if (genreRow) {
        if (APPLY) insGenreRow.run(t.id, genreRow.id);
        genreFixed += 1;
      }
    }
  }

  /* 3) kadro: sadece hic yok ise (yonetmen + ilk 8 oyuncu) */
  if (t.creditCount === 0 && Array.isArray(detail.credits?.crew) && Array.isArray(detail.credits?.cast)) {
    const entries = [];
    for (const c of detail.credits.crew.filter((c) => c.department === "Directing" && c.job === "Director").slice(0, 2)) {
      entries.push({ name: c.name, tmdbId: c.id, role: "director", char: "", order: 0 });
    }
    for (const a of (detail.credits.cast ?? []).slice(0, 8)) {
      entries.push({ name: a.name, tmdbId: a.id, role: "actor", char: a.character ?? "", order: a.order ?? null });
    }
    for (const e of entries) {
      if (!e.name) continue;
      let pid = e.tmdbId ? findPersonByTmdb.get(String(e.tmdbId))?.id : null;
      if (!pid) pid = findPersonByName.get(e.name)?.id ?? null;
      if (!pid) {
        pid = newId("per");
        if (APPLY) insPerson.run(pid, e.name, e.tmdbId ? String(e.tmdbId) : null, nowIso());
      }
      if (APPLY) insCredit.run(newId("crd"), t.id, pid, e.role, e.char ?? "", e.order);
    }
    creditFixed += 1;
  }

  await new Promise((r) => setTimeout(r, 300));
}

console.log(
  APPLY
    ? `Bitti: ${rated} puan dolduruldu, ${ratedMiss} bulunamadi, ${genreFixed} tur eklendi, ${creditFixed} kadro eklendi.`
    : `Dry-run: ${rated} puan dolabilir, ${ratedMiss} bulunamadi, ${genreFixed} tur, ${creditFixed} kadro.`
);
db.close();
