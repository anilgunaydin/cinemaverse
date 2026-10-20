import "server-only";

import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  credits,
  genres as genresTable,
  people,
  titleAliases,
  titleGenres,
  titles,
} from "@/lib/db/schema";
import { newId, nowIso } from "@/lib/http";
import {
  normalizeTitle,
  scoreMatch,
  type MatchCandidate,
} from "@/lib/catalog/matching";
import type {
  CreditItem,
  ProviderSearchOutcome,
  SearchResult,
  TitleDetails,
} from "@/lib/providers/types";
import { searchTvmaze, getTvmazeDetails } from "@/lib/providers/tvmaze";
import {
  getWikipediaSummary,
  getWikidataDetails,
  searchWikidata,
} from "@/lib/providers/wikidata";

/* -------------------------------------------------------------------------- */
/* Tur sozlugu                                                                */
/* -------------------------------------------------------------------------- */

/** Ingilizce tur adi -> { slug, tr, en } */
const GENRE_DICTIONARY: Record<string, { slug: string; tr: string }> = {
  action: { slug: "action", tr: "Aksiyon" },
  adventure: { slug: "adventure", tr: "Macera" },
  animation: { slug: "animation", tr: "Animasyon" },
  anime: { slug: "anime", tr: "Anime" },
  biography: { slug: "biography", tr: "Biyografi" },
  comedy: { slug: "comedy", tr: "Komedi" },
  crime: { slug: "crime", tr: "Suç" },
  documentary: { slug: "documentary", tr: "Belgesel" },
  drama: { slug: "drama", tr: "Dram" },
  family: { slug: "family", tr: "Aile" },
  fantasy: { slug: "fantasy", tr: "Fantastik" },
  history: { slug: "history", tr: "Tarih" },
  horror: { slug: "horror", tr: "Korku" },
  music: { slug: "music", tr: "Müzik" },
  mystery: { slug: "mystery", tr: "Gizem" },
  romance: { slug: "romance", tr: "Romantik" },
  "science fiction": { slug: "science-fiction", tr: "Bilim Kurgu" },
  "sci-fi": { slug: "science-fiction", tr: "Bilim Kurgu" },
  "science fiction film": { slug: "science-fiction", tr: "Bilim Kurgu" },
  "science fiction action film": { slug: "science-fiction", tr: "Bilim Kurgu" },
  thriller: { slug: "thriller", tr: "Gerilim" },
  war: { slug: "war", tr: "Savaş" },
  western: { slug: "western", tr: "Western" },
  "drama film": { slug: "drama", tr: "Dram" },
  "action film": { slug: "action", tr: "Aksiyon" },
  "adventure film": { slug: "adventure", tr: "Macera" },
  "comedy film": { slug: "comedy", tr: "Komedi" },
  "crime film": { slug: "crime", tr: "Suç" },
  "horror film": { slug: "horror", tr: "Korku" },
  "thriller film": { slug: "thriller", tr: "Gerilim" },
  "mystery film": { slug: "mystery", tr: "Gizem" },
  "romance film": { slug: "romance", tr: "Romantik" },
  "war film": { slug: "war", tr: "Savaş" },
  "western film": { slug: "western", tr: "Western" },
  "fantasy film": { slug: "fantasy", tr: "Fantastik" },
  "heist film": { slug: "heist", tr: "Soygun" },
  "animated film": { slug: "animation", tr: "Animasyon" },
  "documentary film": { slug: "documentary", tr: "Belgesel" },
  "musical film": { slug: "music", tr: "Müzik" },
  "psychological thriller film": { slug: "thriller", tr: "Gerilim" },
  "biographical film": { slug: "biography", tr: "Biyografi" },
  "historical drama film": { slug: "history", tr: "Tarih" },
  "teen film": { slug: "teen", tr: "Gençlik" },
  "superhero film": { slug: "superhero", tr: "Süper Kahraman" },
};

export function resolveGenre(name: string): { slug: string; tr: string; en: string } {
  const key = name.trim().toLowerCase();
  const known = GENRE_DICTIONARY[key];
  if (known) {
    return { slug: known.slug, tr: known.tr, en: titleCase(name) };
  }

  // "action film" -> "action", "drama film" -> "drama" gibi ekleri ayikla.
  const stripped = key.replace(/\s+(film|dizi|series|television series)$/i, "");
  const strippedKnown = GENRE_DICTIONARY[stripped];
  if (strippedKnown) {
    return { slug: strippedKnown.slug, tr: strippedKnown.tr, en: titleCase(stripped) };
  }

  const slug = normalizeTitle(stripped).replace(/\s+/g, "-") || "diger";
  return { slug, tr: titleCase(stripped), en: titleCase(stripped) };
}

function titleCase(input: string): string {
  return input
    .split(/\s+/)
    .map((word) => word.charAt(0).toLocaleUpperCase("tr") + word.slice(1))
    .join(" ");
}

async function ensureGenreId(name: string): Promise<string> {
  const resolved = resolveGenre(name);
  const db = getDb();
  const existing = await db
    .select({ id: genresTable.id })
    .from(genresTable)
    .where(eq(genresTable.slug, resolved.slug))
    .limit(1);
  if (existing[0]) return existing[0].id;

  const id = `genre_${resolved.slug}`;
  await db
    .insert(genresTable)
    .values({
      id,
      slug: resolved.slug,
      nameTr: resolved.tr,
      nameEn: resolved.en,
    })
    .onConflictDoNothing();
  return id;
}

/* -------------------------------------------------------------------------- */
/* Arama                                                                      */
/* -------------------------------------------------------------------------- */

export type MergedSearchResult = SearchResult & {
  /** Ayni yapim birden fazla kaynaktan geldiyse kimlikler birlestirilir. */
  sources: string[];
};

function dedupeSearchResults(results: SearchResult[]): MergedSearchResult[] {
  const merged: MergedSearchResult[] = [];

  for (const result of results) {
    const duplicate = merged.find((existing) => {
      if (result.imdbId && existing.imdbId && result.imdbId === existing.imdbId) {
        return true;
      }
      return (
        existing.provider === result.provider &&
        existing.providerId === result.providerId
      );
    });

    if (duplicate) {
      duplicate.sources = [...new Set([...duplicate.sources, result.provider])];
      duplicate.imdbId = duplicate.imdbId ?? result.imdbId;
      duplicate.posterUrl = duplicate.posterUrl ?? result.posterUrl;
      duplicate.overview = duplicate.overview ?? result.overview;
      duplicate.externalRating = duplicate.externalRating ?? result.externalRating;
      duplicate.releaseYear = duplicate.releaseYear ?? result.releaseYear;
      duplicate.matchScore = Math.max(duplicate.matchScore, result.matchScore);
      continue;
    }

    merged.push({ ...result, sources: [result.provider] });
  }

  return merged.sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Tum uygun saglayicilarda arama yapar. Bir saglayici cokse bile
 * digerlerinin sonuclari doner; hatalar ayrica raporlanir.
 */
export async function searchCatalog(input: {
  query: string;
  kind?: "movie" | "series" | "all";
  year?: number | null;
  language?: string;
}): Promise<{
  results: MergedSearchResult[];
  providerStatus: ProviderSearchOutcome[];
}> {
  const query = input.query.trim();
  const kind = input.kind ?? "all";
  const language = input.language ?? "tr";

  if (query.length < 2) {
    return { results: [], providerStatus: [] };
  }

  const tasks: Promise<ProviderSearchOutcome>[] = [];

  if (kind === "movie" || kind === "all") {
    tasks.push(searchWikidata(query, "movie", language));
  }
  if (kind === "series" || kind === "all") {
    tasks.push(searchTvmaze(query));
    tasks.push(searchWikidata(query, "series", language));
  }

  const settled = await Promise.all(tasks);

  const scored: SearchResult[] = [];
  for (const outcome of settled) {
    for (const result of outcome.results) {
      const candidate: MatchCandidate = {
        originalTitle: result.originalTitle,
        localizedTitle: result.localizedTitle,
        releaseYear: result.releaseYear,
        kind: result.kind,
        imdbId: result.imdbId,
        tvmazeId: result.provider === "tvmaze" ? result.providerId : null,
        wikidataId: result.provider === "wikidata" ? result.providerId : null,
      };
      const matchScore = scoreMatch(
        query,
        candidate,
        input.year ?? null,
        kind === "all" ? null : kind,
      );
      if (matchScore < 0.35) continue;
      scored.push({ ...result, matchScore });
    }
  }

  const merged = dedupeSearchResults(scored);

  return {
    results: merged.slice(0, 40),
    providerStatus: settled.map((outcome) => ({
      ...outcome,
      results: [],
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Yapim kaydi (upsert)                                                       */
/* -------------------------------------------------------------------------- */

export type ImportInput = {
  provider: "wikidata" | "tvmaze";
  providerId: string;
  language?: string;
};

export async function importTitle(input: ImportInput): Promise<{
  titleId: string;
  created: boolean;
  details: TitleDetails;
}> {
  const language = input.language ?? "tr";

  const details =
    input.provider === "tvmaze"
      ? await getTvmazeDetails(input.providerId)
      : await getWikidataDetails(input.providerId, language);

  // Wikipedia ozeti, Wikidata'nin tek satirlik aciklamasindan daha zengindir.
  // Yalnizca kaynak gercekten varsa kullanilir; aksi halde mevcut aciklama kalir.
  //
  // Ozet OPSIYONELDIR: Wikipedia hiz siniri (429) veya gecici bir hata
  // almamasi yapim kaydinin import edilmesini engellememelidir.
  if (details.provider === "wikidata" && details.originalTitle) {
    const wikiLanguage = language === "tr" ? "tr" : "en";
    try {
      const summary = await getWikipediaSummary(
        details.originalTitle,
        wikiLanguage,
      );
      if (
        summary?.extract &&
        summary.extract.length > (details.overview?.length ?? 0)
      ) {
        details.overview = summary.extract.slice(0, 1500);
        details.verifiedFields.push("overview");
        if (!details.sourceUrl) details.sourceUrl = summary.url;
      }
    } catch {
      // Wikipedia ozeti alinamadi; kayit yine de eklenir.
    }
  }

  const db = getDb();
  const existingRows = await db
    .select({ id: titles.id })
    .from(titles)
    .where(
      input.provider === "tvmaze"
        ? eq(titles.tvmazeId, input.providerId)
        : eq(titles.wikidataId, input.providerId),
    )
    .limit(1);

  const now = nowIso();
  let titleId = existingRows[0]?.id;
  const created = !titleId;

  const values = {
    kind: details.kind,
    tmdbId: details.tmdbId,
    tvmazeId: details.tvmazeId,
    imdbId: details.imdbId,
    wikidataId: details.wikidataId,
    originalTitle: details.originalTitle,
    localizedTitle:
      details.localizedTitle && details.localizedTitle !== details.originalTitle
        ? details.localizedTitle
        : null,
    originalLanguage: details.originalLanguage,
    overview: details.overview,
    releaseDate: details.releaseDate,
    releaseYear: details.releaseYear,
    endDate: details.endDate,
    runtimeMinutes: details.runtimeMinutes,
    posterUrl: details.posterUrl,
    backdropUrl: details.backdropUrl,
    homepageUrl: details.homepageUrl,
    externalRating: details.externalRating,
    externalRatingCount: details.externalRatingCount,
    externalRatingSource: details.externalRatingSource,
    metadataProvider: details.provider,
    metadataUpdatedAt: now,
    metadataVerified: true,
    updatedAt: now,
  };

  if (titleId) {
    await db.update(titles).set(values).where(eq(titles.id, titleId));
  } else {
    titleId = newId("ttl");
    await db.insert(titles).values({
      id: titleId,
      ...values,
      createdAt: now,
    });
  }

  // Turler
  for (const genreName of details.genres) {
    const genreId = await ensureGenreId(genreName);
    await db
      .insert(titleGenres)
      .values({ titleId, genreId, provider: details.provider })
      .onConflictDoNothing();
  }

  // Ekip
  await upsertCredits(titleId, details.credits, details.provider);

  // Alternatif basliklar
  for (const alias of details.aliases.slice(0, 60)) {
    if (!alias.name || alias.name.trim().length === 0) continue;
    await db
      .insert(titleAliases)
      .values({
        id: newId("als"),
        titleId,
        name: alias.name.trim().slice(0, 300),
        language: alias.language,
        provider: details.provider,
      })
      .onConflictDoNothing();
  }

  // Sezonlar (dizi ise)
  if (details.kind === "series" && details.seasons.length > 0) {
    for (const season of details.seasons) {
      const seasonKey = `${details.provider}:${season.providerId}`;
      const existingSeason = await db
        .select({ id: titles.id })
        .from(titles)
        .where(
          and(
            eq(titles.parentId, titleId),
            eq(titles.seasonNumber, season.seasonNumber),
            eq(titles.kind, "season"),
          ),
        )
        .limit(1);

      if (existingSeason[0]) {
        await db
          .update(titles)
          .set({
            originalTitle:
              season.name ?? `${details.originalTitle} ${season.seasonNumber}. Sezon`,
            releaseDate: season.premiereDate,
            releaseYear: season.premiereDate
              ? Number(season.premiereDate.slice(0, 4))
              : null,
            endDate: season.endDate,
            posterUrl: season.posterUrl,
            metadataProvider: details.provider,
            metadataUpdatedAt: now,
            updatedAt: now,
          })
          .where(eq(titles.id, existingSeason[0].id));
      } else {
        await db.insert(titles).values({
          id: newId("ttl"),
          kind: "season",
          parentId: titleId,
          seasonNumber: season.seasonNumber,
          originalTitle:
            season.name ?? `${details.originalTitle} ${season.seasonNumber}. Sezon`,
          releaseDate: season.premiereDate,
          releaseYear: season.premiereDate
            ? Number(season.premiereDate.slice(0, 4))
            : null,
          endDate: season.endDate,
          posterUrl: season.posterUrl,
          metadataProvider: details.provider,
          metadataUpdatedAt: now,
          metadataVerified: true,
          createdAt: now,
          updatedAt: now,
        });
      }
      void seasonKey;
    }
  }

  return { titleId, created, details };
}

async function upsertCredits(
  titleId: string,
  items: CreditItem[],
  provider: string,
): Promise<void> {
  if (items.length === 0) return;
  const db = getDb();

  for (const item of items) {
    const name = item.name?.trim();
    if (!name) continue;

    let personId: string | null = null;

    if (item.providerId) {
      const externalId = item.providerId;
      const existing = await db
        .select({ id: people.id })
        .from(people)
        .where(
          provider === "tvmaze"
            ? eq(people.tvmazeId, externalId)
            : eq(people.wikidataId, externalId),
        )
        .limit(1);
      if (existing[0]) {
        personId = existing[0].id;
      } else {
        personId = newId("per");
        await db.insert(people).values({
          id: personId,
          name,
          tvmazeId: provider === "tvmaze" ? externalId : null,
          wikidataId: provider === "wikidata" ? externalId : null,
        });
      }
    } else {
      const existing = await db
        .select({ id: people.id })
        .from(people)
        .where(sql`lower(${people.name}) = ${name.toLowerCase()}`)
        .limit(1);
      if (existing[0]) {
        personId = existing[0].id;
      } else {
        personId = newId("per");
        await db.insert(people).values({ id: personId, name });
      }
    }

    await db
      .insert(credits)
      .values({
        id: newId("crd"),
        titleId,
        personId,
        role: item.role,
        characterName: item.characterName ?? "",
        billingOrder: item.billingOrder ?? null,
        provider,
      })
      .onConflictDoNothing();
  }
}

/* -------------------------------------------------------------------------- */
/* Okuma                                                                      */
/* -------------------------------------------------------------------------- */

export type TitleRow = typeof titles.$inferSelect;

export async function getTitleById(id: string): Promise<TitleRow | null> {
  const db = getDb();
  const rows = await db.select().from(titles).where(eq(titles.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getTitleDetail(id: string) {
  const db = getDb();
  const title = await getTitleById(id);
  if (!title) return null;

  const [genreRows, creditRows, aliasRows, seasonRows] = await Promise.all([
    db
      .select({
        slug: genresTable.slug,
        nameTr: genresTable.nameTr,
        nameEn: genresTable.nameEn,
      })
      .from(titleGenres)
      .innerJoin(genresTable, eq(titleGenres.genreId, genresTable.id))
      .where(eq(titleGenres.titleId, id)),
    db
      .select({
        role: credits.role,
        characterName: credits.characterName,
        billingOrder: credits.billingOrder,
        personName: people.name,
        personId: people.id,
      })
      .from(credits)
      .innerJoin(people, eq(credits.personId, people.id))
      .where(eq(credits.titleId, id))
      .orderBy(credits.role, credits.billingOrder),
    db
      .select({ name: titleAliases.name, language: titleAliases.language })
      .from(titleAliases)
      .where(eq(titleAliases.titleId, id))
      .limit(30),
    db
      .select()
      .from(titles)
      .where(and(eq(titles.parentId, id), eq(titles.kind, "season")))
      .orderBy(titles.seasonNumber),
  ]);

  return {
    title,
    genres: genreRows,
    credits: creditRows,
    aliases: aliasRows,
    seasons: seasonRows,
  };
}

export async function listTitles(input: {
  query?: string;
  kind?: string;
  genreSlug?: string;
  year?: number;
  limit?: number;
  offset?: number;
  sort?: "recent" | "title" | "year";
}): Promise<{ items: TitleRow[]; total: number }> {
  const db = getDb();
  const limit = Math.min(Math.max(input.limit ?? 24, 1), 100);
  const offset = Math.max(input.offset ?? 0, 0);

  const conditions = [] as ReturnType<typeof eq>[];

  if (input.kind) {
    conditions.push(eq(titles.kind, input.kind as TitleRow["kind"]));
  } else {
    conditions.push(inArray(titles.kind, ["movie", "series"]));
  }
  if (input.year) {
    conditions.push(eq(titles.releaseYear, input.year));
  }
  if (input.query && input.query.trim().length > 0) {
    const likeValue = `%${input.query.trim().toLowerCase()}%`;
    conditions.push(
      or(
        like(sql`lower(${titles.originalTitle})`, likeValue),
        like(sql`lower(coalesce(${titles.localizedTitle}, ''))`, likeValue),
      )!,
    );
  }

  const whereClause = and(...conditions);

  const countRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(titles)
    .where(whereClause);

  const orderBy =
    input.sort === "title"
      ? sql`lower(${titles.originalTitle}) asc`
      : input.sort === "year"
        ? sql`coalesce(${titles.releaseYear}, 0) desc`
        : desc(titles.updatedAt);

  const items = await db
    .select()
    .from(titles)
    .where(whereClause)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  return { items, total: Number(countRows[0]?.count ?? 0) };
}

export async function listGenres() {
  const db = getDb();
  return db.select().from(genresTable).orderBy(genresTable.nameTr);
}

/** Katalogda kayitli ilk N yapim (oneriler icin aday havuzu). */
export async function listCandidateTitles(limit = 500): Promise<TitleRow[]> {
  const db = getDb();
  return db
    .select()
    .from(titles)
    .where(inArray(titles.kind, ["movie", "series"]))
    .orderBy(desc(titles.metadataUpdatedAt))
    .limit(limit);
}
