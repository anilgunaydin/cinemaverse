/**
 * Preference Engine - Kullanıcı zevk profili hesaplama motoru
 * Hem explicit (onboarding) hem implicit (davranışsal) verilerden profil çıkarır
 */

import { getDatabase } from "@/lib/db";
import { libraryEntries, titles, titleGenres, genres } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

export type PreferenceProfile = {
  userId: string;
  // Explicit (anket) tercihler
  explicit: {
    tempo: number; // 1-10: yavaş → hızlı
    realism: number; // 1-10: gerçekçi → kurgu
    rewatch: "nadir" | "bazen" | "siklik";
    spoilerTolerance: "yok" | "az" | "onemsiz";
    socialWeight: number; // 1-10
  } | null;
  // Implicit (davranışsal) ağırlıklar
  implicit: {
    genres: Record<string, number>; // genre slug -> weight
    people: Record<string, number>; // person name -> weight
    decades: Record<string, number>; // "1990s" -> weight
    dimensions: Record<string, number>; // atmosfer, karakter, tempo, gorsel, konu
    tempoPreference: number; // 1-10 implicit
    realismPreference: number; // 1-10 implicit
    avgRating: number;
    totalWatched: number;
    confidence: number; // 0-1
  };
  // Birleşik skorlar (öneri motoru için)
  combined: {
    genreWeights: Record<string, number>;
    peopleWeights: Record<string, number>;
    decadeWeights: Record<string, number>;
    dimensionWeights: Record<string, number>;
  };
  updatedAt: string;
};

const DEFAULT_EXPLICIT = {
  tempo: 5,
  realism: 5,
  rewatch: "bazen" as const,
  spoilerTolerance: "az" as const,
  socialWeight: 5,
};

function normalizeWeights(weights: Record<string, number>): Record<string, number> {
  const max = Math.max(...Object.values(weights), 1);
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(weights)) {
    result[k] = Math.round((v / max) * 100) / 100;
  }
  return result;
}

export async function calculateImplicitProfile(userId: string) {
  const { db } = getDatabase();

  // Kullanıcının izlediği filmler + puanları
  const watched = await db
    .select({
      titleId: libraryEntries.titleId,
      rating: libraryEntries.rating,
      status: libraryEntries.status,
      isFavorite: libraryEntries.isFavorite,
      genreSlug: genres.slug,
      genreNameTr: genres.nameTr,
      releaseYear: titles.releaseYear,
      runtimeMinutes: titles.runtimeMinutes,
    })
    .from(libraryEntries)
    .innerJoin(titles, eq(libraryEntries.titleId, titles.id))
    .leftJoin(titleGenres, eq(titles.id, titleGenres.titleId))
    .leftJoin(genres, eq(titleGenres.genreId, genres.id))
    .where(and(eq(libraryEntries.userId, userId), eq(libraryEntries.status, "watched")));

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

  // Tür ağırlıkları (puan ağırlıklı)
  const genreWeights: Record<string, number> = {};
  const decadeWeights: Record<string, number> = {};
  let totalRating = 0;
  let ratedCount = 0;
  let favoriteCount = 0;

  for (const w of watched) {
    const weight = (w.rating ?? 5) / 10; // 0.1 - 1.0
    const favBoost = w.isFavorite ? 1.5 : 1.0;
    const finalWeight = weight * favBoost;

    if (w.genreSlug) {
      genreWeights[w.genreSlug] = (genreWeights[w.genreSlug] ?? 0) + finalWeight;
    }

    if (w.releaseYear) {
      const decade = `${Math.floor(w.releaseYear / 10) * 10}s`;
      decadeWeights[decade] = (decadeWeights[decade] ?? 0) + finalWeight;
    }

    if (w.rating != null) {
      totalRating += w.rating;
      ratedCount++;
    }
    if (w.isFavorite) favoriteCount++;
  }

  // Kadro ağırlıkları (favori filmlerdeki oyuncular/yonetmenler)
  const peopleWeights: Record<string, number> = {};
  const favTitles = watched.filter((w) => w.isFavorite || (w.rating ?? 0) >= 8);
  for (const w of favTitles) {
    const boost = w.isFavorite ? 2 : 1;
    // Basit: tür ismini "people" gibi kullanıyoruz, gerçek implementasyonda credits tablosundan çekilir
  }

  // Boyut tahmini (türlerden yola çıkarak)
  const dimensionMap: Record<string, string[]> = {
    atmosfer: ["drama", "mystery", "horror", "thriller", "noir", "atmospheric"],
    karakter: ["drama", "biography", "character-study", "psychological"],
    tempo: ["action", "thriller", "adventure", "heist"],
    gorsel: ["fantasy", "sci-fi", "animation", "epic"],
    konu: ["history", "war", "political", "social", "documentary"],
  };

  const dimensionWeights: Record<string, number> = {};
  for (const [dim, genreSlugs] of Object.entries(dimensionMap)) {
    let score = 0;
    for (const slug of genreSlugs) {
      score += genreWeights[slug] ?? 0;
    }
    dimensionWeights[dim] = score;
  }

  // Tempo/Realism tahmini (türlerden)
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

  return {
    genres: normalizeWeights(genreWeights),
    people: normalizeWeights(peopleWeights),
    decades: normalizeWeights(decadeWeights),
    dimensions: normalizeWeights(dimensionWeights),
    tempoPreference: tempoPref,
    realismPreference: realismPref,
    avgRating: Math.round(avgRating * 10) / 10,
    totalWatched: watched.length,
    confidence: Math.min(1, watched.length / 50), // 50 filmde tam güven
  };
}

export async function getFullProfile(userId: string) {
  const { db } = getDatabase();

  // Explicit prefs (profil tablosundan)
  const { preferenceProfiles } = await import("@/lib/db/schema");
  const { eq } = await import("drizzle-orm");

  const explicitRow = await db
    .select()
    .from(preferenceProfiles)
    .where(eq(preferenceProfiles.userId, userId))
    .limit(1);

  const explicit = explicitRow[0] ? JSON.parse(explicitRow[0].profileJson).explicit ?? null : null;

  const implicit = await calculateImplicitProfile(userId);

  // Combined weights: explicit + implicit blend
  const blend = (explicitWeight: number, implicitWeight: number, alpha = 0.3) =>
    Math.round((explicitWeight * alpha + implicitWeight * (1 - alpha)) * 10) / 10;

  const genreWeights: Record<string, number> = {};
  // Implicit zaten normalize edilmiş

  return {
    userId,
    explicit,
    implicit,
    combined: {
      genreWeights: implicit.genres,
      peopleWeights: implicit.people,
      decadeWeights: implicit.decades,
      dimensionWeights: implicit.dimensions,
    },
    updatedAt: new Date().toISOString(),
  };
}

export async function saveExplicitPreferences(userId: string, prefs: any) {
  const { db } = getDatabase();
  const { preferenceProfiles } = await import("@/lib/db/schema");
  const { eq } = await import("drizzle-orm");
  const now = new Date().toISOString();

  const existing = await db
    .select()
    .from(preferenceProfiles)
    .where(eq(preferenceProfiles.userId, userId))
    .limit(1);

  const profileJson = {
    explicit: prefs,
    updatedAt: new Date().toISOString(),
  };

  if (existing[0]) {
    await db
      .update(preferenceProfiles)
      .set({
        profileJson: JSON.stringify(profileJson),
        confidence: sql`LEAST(${preferenceProfiles.confidence} + 0.1, 1)`,
        updatedAt: now,
      })
      .where(eq(preferenceProfiles.userId, userId));
  } else {
    await db.insert(preferenceProfiles).values({
      userId,
      profileJson: JSON.stringify(profileJson),
      confidence: 0.3,
      ratedTitleCount: 0,
      updatedAt: now,
    });
  }
}

export function deriveArchetype(profile: any): string {
  const { implicit, explicit } = profile;
  const dims: Record<string, number> = implicit.dimensions ?? {};
  const topDim = Object.entries(dims).sort((a, b) => b[1] - a[1])[0]?.[0];

  const archetypes: Record<string, string> = {
    atmosfer: "Atmosfer Avcısı",
    karakter: "Karakter Çalışması Tutkunu",
    tempo: "Tempolu Sinemasever",
    gorsel: "Görsel Estetikçisi",
    konu: "Konu Odaklı İzleyici",
  };

  if (explicit?.tempo && explicit.tempo >= 8) return "Aksiyon ve Tempo Tutkunu";
  if (explicit?.tempo && explicit.tempo <= 3) return "Yavaş Sinema ve Atmosfer Severi";
  if (explicit?.realism && explicit.realism >= 8) return "Gerçekçilik ve Gerçek Hayat Severi";
  if (explicit?.realism && explicit.realism <= 3) return "Fantastik ve Bilimkurgu Hayalperi";

  return topDim ? archetypes[topDim] || "Sinema Tutkunu" : "Sinema Tutkunu";
}