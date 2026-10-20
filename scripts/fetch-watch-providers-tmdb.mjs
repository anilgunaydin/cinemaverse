/**
 * TMDb'den Türkiye (TR) yayin platformlarini ceker
 * watch/providers endpoint kullanir
 *   node --env-file=.env scripts/fetch-watch-providers-tmdb.mjs            # dry-run
 *   node --env-file=.env scripts/fetch-watch-providers-tmdb.mjs --apply
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
  const yr = t.release_year ?? "";
  const extra = `query=${query}` + (yr ? (media === "movie" ? `&year=${yr}` : `&first_air_date_year=${yr}`) : "");
  const search = await tmdb(`/search/${media}`, extra);
  const results = search?.results ?? [];
  for (const r of results.slice(0, 3)) {
    const ry = yearOf(r.release_date ?? r.first_air_date ?? null);
    if (t.release_year == null || ry == null) return r;
    if (Math.abs(ry - t.release_year) <= 1) return r;
  }
  return results[0] ?? null;
}

const titles = db
  .prepare(
    `SELECT t.id, t.kind, t.original_title, t.localized_title, t.release_year, t.imdb_id, t.tmdb_id
     FROM titles t
     WHERE t.kind IN ('movie','series')
     ORDER BY t.id`
  )
  .all();

console.log("Islenecek:", titles.length);

const upsertProvider = db.prepare(
  `INSERT INTO watch_providers (id, name, logo_path, display_priority, monetization_types, updated_at)
   VALUES (?, ?, ?, ?, ?, ?)
   ON CONFLICT(id) DO UPDATE SET
     name = excluded.name,
     logo_path = excluded.logo_path,
     display_priority = excluded.display_priority,
     monetization_types = excluded.monetization_types,
     updated_at = excluded.updated_at`
);

const upsertTitleProvider = db.prepare(
  `INSERT INTO title_watch_providers (id, title_id, provider_id, monetization_type, link, quality, region, last_checked)
   VALUES (?, ?, ?, ?, ?, ?, 'TR', ?)
   ON CONFLICT(title_id, provider_id, monetization_type) DO UPDATE SET
     link = excluded.link,
     quality = excluded.quality,
     last_checked = excluded.last_checked`
);

let totalProviders = 0;
let totalLinks = 0;

for (const t of titles) {
  const media = t.kind === "movie" ? "movie" : "tv";
  const tmdbId = t.tmdb_id ?? (await findTmdbId(t, media))?.id;
  
  if (!tmdbId) {
    console.log("  TMDB ID bulunamadi:", (t.localized_title ?? t.original_title ?? "?").slice(0, 40));
    continue;
  }

  const providers = await tmdb(`/${media}/${tmdbId}/watch/providers`);
  const tr = providers?.results?.TR;
  if (!tr) {
    console.log("  TR provider yok:", (t.localized_title ?? t.original_title ?? "?").slice(0, 40));
    continue;
  }

  const monetizationTypes = ["flatrate", "rent", "buy", "free", "ads"];
  let titleLinkCount = 0;

  for (const mType of monetizationTypes) {
    const items = tr[mType];
    if (!items || !Array.isArray(items) || items.length === 0) continue;

    for (const item of items) {
      const providerId = item.provider_id;
      const providerName = item.provider_name;
      const logoPath = item.logo_path;
      const displayPriority = item.display_priority ?? 0;
      const link = item.link ?? null;
      const quality = item.quality ?? null;

      // Provider kaydet/guncelle
      if (APPLY) {
        upsertProvider.run(providerId, providerName, logoPath, displayPriority, JSON.stringify([mType]), nowIso());
      }
      totalProviders++;

      // Title-Provider baglantisi
      if (APPLY) {
        upsertTitleProvider.run(newId("twp"), t.id, providerId, mType, link, quality, nowIso());
      }
      totalLinks++;

      console.log(`  + ${(t.localized_title ?? t.original_title ?? "?").slice(0, 35)} | ${providerName} | ${mType}${link ? " (link)" : ""}`);
    }
  }

  await new Promise((r) => setTimeout(r, 250));
}

console.log(
  APPLY
    ? `Bitti: ${totalProviders} provider islendi, ${totalLinks} baglanti kaydedildi.`
    : `Dry-run: ${totalProviders} provider, ${totalLinks} baglanti.`
);
db.close();