/**
 * Haftalık Preference Profili Güncelleme Scripti
 * 
 * Her hafta çalıştırılır (cron: 0 3 * * 0 - her Pazar 03:00)
 * Tüm kullanıcıların implicit profillerini yeniden hesaplar
 * 
 *   npm run preferences:update
 *   veya
 *   npx tsx scripts/update-preferences.ts
 */

import { getScriptDatabase } from "./lib/script-db";
import { preferenceProfiles } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";
import { libraryEntries, titles, titleGenres, genres, credits, people } from "../src/lib/db/schema";
import { eq as eq_, and, sql, inArray } from "drizzle-orm";

interface WatchedMovie {
  titleId: string;
  rating: number | null;
  isFavorite: boolean;
  genreSlug: string | null;
  releaseYear: number | null;
}

function normalizeWeights(obj: Record<string, number>): Record<string, number> {
  const max = Math.max(...Object.values(obj), 1);
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = Math.round((v / max) * 100) / 100;
  }
  return result;
}

async function calculateImplicitForUser(db: any, userId: string) {
  // Kullanıcının izlediği filmler
  const watched = await db
    .select({
      titleId: libraryEntries.titleId,
      rating: libraryEntries.rating,
      status: libraryEntries.status,
      isFavorite: libraryEntries.isFavorite,
      genreSlug: genres.slug,
      genreNameTr: genres.nameTr,
      releaseYear: titles.releaseYear,
    })
    .from(libraryEntries)
    .innerJoin(titles, eq_(libraryEntries.titleId, titles.id))
    .leftJoin(titleGenres, eq_(titles.id, titleGenres.titleId))
    .leftJoin(genres, eq_(titleGenres.genreId, genres.id))
    .where(and(eq_(libraryEntries.userId, userId), eq_(libraryEntries.status, "watched"))) as WatchedMovie[];

  if (watched.length === 0) {
    return {
      genres: {},
      people: {},
      decades: {},
      dimensions: {},
      tempoPreference: 5,
      realismPreference: 5,
      avgRating: 0,
      totalWatched: 0,
      confidence: 0,
    };
  }

  const genreWeights: Record<string, number> = {};
  const decadeWeights: Record<string, number> = {};
  let totalRating = 0;
  let ratedCount = 0;
  let favoriteCount = 0;

  const dimensionMap: Record<string, string[]> = {
    atmosfer: ["drama", "mystery", "horror", "thriller", "noir"],
    karakter: ["drama", "biography", "character-study", "psychological"],
    tempo: ["action", "thriller", "adventure", "heist"],
    gorsel: ["fantasy", "sci-fi", "animation", "epic"],
    konu: ["history", "war", "political", "social", "documentary"],
  };

  for (const w of watched) {
    const weight = (w.rating ?? 5) / 10;
    const favBoost = w.isFavorite ? 1.5 : 1.0;
    const finalWeight = weight * favBoost;

    if (w.genreSlug) {
      genreWeights[w.genreSlug] = (genreWeights[w.genreSlug] ?? 0) + finalWeight;

      // Boyut ağırlığı
      for (const [dim, slugs] of Object.entries(dimensionMap)) {
        if (slugs.includes(w.genreSlug)) {
          // We'll accumulate per dimension later
        }
      }
    }

    if (w.releaseYear) {
      const decade = `${Math.floor(w.releaseYear / 10) * 10}s`;
      decadeWeights[decade] = (decadeWeights[decade] ?? 0) + (w.rating ?? 5) / 10;
    }

    if (w.rating != null) totalRating += w.rating;
    if (w.isFavorite) favoriteCount++;
  }

  // Boyut ağırlıkları (türlerden)
  const dimensionWeights: Record<string, number> = {};
  for (const [dim, slugs] of Object.entries(dimensionMap)) {
    let score = 0;
    for (const slug of slugs) {
      score += genreWeights[slug] ?? 0;
    }
    dimensionWeights[dim] = score;
  }

  // Kadro ağırlıkları (oyuncu/yonetmen)
  const peopleWeights = await calculatePeopleWeights(db, watched);

  // Tempo/Realism tahmini
  const tempoGenres = ["action", "thriller", "adventure", "heist", "action-thriller"];
  const slowGenres = ["drama", "mystery", "arthouse", "slow-cinema", "character-study"];
  const realisticGenres = ["drama", "biography", "history", "war", "documentary", "crime"];
  const fantasyGenres = ["fantasy", "sci-fi", "superhero", "supernatural", "magic"];

  let tempoScore = 0, realismScore = 0, totalW = 0;
  for (const [slug, w] of Object.entries(genreWeights)) {
    totalW += w;
    if (tempoGenres.includes(slug)) tempoScore += w * 2;
    else if (slowGenres.includes(slug)) tempoScore -= w;
    if (realisticGenres.includes(slug)) realismScore += w * 2;
    else if (fantasyGenres.includes(slug)) realismScore -= w;
  }

  const tempoPref = totalW > 0 ? Math.max(1, Math.min(10, 5 + Math.round((tempoScore / totalW) * 5))) : 5;
  const realismPref = totalW > 0 ? Math.max(1, Math.min(10, 5 + Math.round((realismScore / totalW) * 5))) : 5;

  const ratedMovies = watched.filter((w) => w.rating != null);
  const avgRating = ratedMovies.length > 0
    ? ratedMovies.reduce((sum, w) => sum + (w.rating ?? 0), 0) / ratedMovies.length
    : 0;

  function normalize(obj: Record<string, number>) {
    const max = Math.max(...Object.values(obj), 1);
    const result: Record<string, number> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = Math.round((v / max) * 100) / 100;
    }
    return result;
  }

  return {
    genres: normalize(genreWeights),
    people: peopleWeights,
    decades: normalize(decadeWeights),
    dimensions: normalize(dimensionWeights),
    tempoPreference: tempoPref,
    realismPreference: realismPref,
    avgRating: Math.round(avgRating * 10) / 10,
    totalWatched: watched.length,
    confidence: Math.min(1, watched.length / 50),
  };
}

interface PreferenceProfileRow {
  userId: string;
  profileJson: string;
  confidence: number;
  ratedTitleCount: number;
  updatedAt: string;
}

/**
 * Kadro (oyuncu/yönetmen) ağırlıklarını hesaplar.
 * Yönetmenler 1.6x, yazarlar 0.8x, oyuncular 1.0x çarpan alır.
 * Oyuncularda ilk 3 isim daha değerli (billing order).
 */
async function calculatePeopleWeights(
  db: any,
  watched: WatchedMovie[]
): Promise<Record<string, number>> {
  if (watched.length === 0) return {};

  const titleIds = [...new Set(watched.map((w) => w.titleId))];
  if (titleIds.length === 0) return {};

  const rows = await db
    .select({
      titleId: credits.titleId,
      role: credits.role,
      billingOrder: credits.billingOrder,
      personName: people.name,
    })
    .from(credits)
    .innerJoin(people, eq_(credits.personId, people.id))
    .where(inArray(credits.titleId, titleIds));

  const titleWeight = new Map<string, number>();
  for (const w of watched) {
    const base = (w.rating ?? 5) / 10;
    const favBoost = w.isFavorite ? 1.8 : 1.0;
    titleWeight.set(w.titleId, base * favBoost);
  }

  const ROLE_MULTIPLIER: Record<string, number> = {
    director: 1.6,
    creator: 1.5,
    writer: 0.8,
    actor: 1.0,
    composer: 0.6,
  };

  const weights: Record<string, number> = {};
  for (const row of rows) {
    const tw = titleWeight.get(row.titleId) ?? 0.5;
    if (tw <= 0) continue;

    // Kaynakta isim yoksa Wikidata ID (Q...) yazilmis olabilir; bunlari atla.
    const name = row.personName?.trim();
    if (!name || /^Q\d+$/i.test(name)) continue;

    let roleMult = ROLE_MULTIPLIER[row.role] ?? 1.0;
    if (row.role === "actor") {
      const order = row.billingOrder ?? 99;
      if (order > 5) roleMult *= 0.35;
      else if (order > 2) roleMult *= 0.7;
    }

    weights[name] = (weights[name] ?? 0) + tw * roleMult;
  }

  return normalizeWeights(weights);
}

async function main() {
  console.log("[Preference Update] Starting weekly profile update...");
  const startTime = Date.now();

  const { db, sqlite } = getScriptDatabase();

  // Tüm kullanıcıları al
  const users = sqlite.prepare("SELECT id FROM users").all() as { id: string }[];
  console.log(`[Preference Update] Found ${users.length} users`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const user of users) {
    try {
      const implicit = await calculateImplicitForUser(db, user.id);

      if (implicit.totalWatched === 0) {
        console.log(`  - User ${user.id}: no watched movies, skipping`);
        skipped++;
        continue;
      }

      // Mevcut profili al
      const existing = db
        .select()
        .from(preferenceProfiles)
        .where(eq(preferenceProfiles.userId, user.id))
        .limit(1) as unknown as PreferenceProfileRow[];

      const profileJson = {
        explicit: existing[0] ? JSON.parse(existing[0].profileJson).explicit ?? null : null,
        implicit: {
          genres: implicit.genres,
          people: implicit.people,
          decades: implicit.decades,
          dimensions: implicit.dimensions,
          tempoPreference: implicit.tempoPreference,
          realismPreference: implicit.realismPreference,
          avgRating: implicit.avgRating,
          totalWatched: implicit.totalWatched,
          confidence: implicit.confidence,
        },
        updatedAt: new Date().toISOString(),
      };

      if (existing.length > 0) {
        const existingProfile = existing[0];
        db.update(preferenceProfiles)
          .set({
            profileJson: JSON.stringify(profileJson),
            confidence: Math.min(1, (existingProfile.confidence ?? 0) + 0.05),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(preferenceProfiles.userId, user.id))
          .run();
      } else {
        // Try insert, if fails due to unique constraint, do update
        try {
          db.insert(preferenceProfiles).values({
            userId: user.id,
            profileJson: JSON.stringify(profileJson),
            confidence: 0.3,
            ratedTitleCount: 0,
            updatedAt: new Date().toISOString(),
          }).run();
        } catch (e: any) {
          if (e.message?.includes("UNIQUE constraint failed")) {
            const existingProfile = existing.length > 0 ? existing[0] : null;
            db.update(preferenceProfiles)
              .set({
                profileJson: JSON.stringify(profileJson),
                confidence: Math.min(1, (existingProfile?.confidence ?? 0) + 0.05),
                updatedAt: new Date().toISOString(),
              })
              .where(eq(preferenceProfiles.userId, user.id))
              .run();
          } else {
            throw e;
          }
        }
      }

      console.log(`  ✓ User ${user.id}: ${Object.keys(implicit.genres).length} genres, ${implicit.totalWatched} watched, confidence ${Math.round(implicit.confidence * 100)}%`);
      updated++;

    } catch (e: any) {
      console.error(`  ✗ User ${user.id}: ${e.message}`);
      errors++;
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[Preference Update] Complete in ${duration}s: ${updated} updated, ${skipped} skipped, ${errors} errors`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[Preference Update] Fatal:", e);
    process.exit(1);
  });