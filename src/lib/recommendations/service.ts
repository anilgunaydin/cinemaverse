import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  libraryEntries,
  recommendationFeedback,
  recommendations,
  titles,
} from "@/lib/db/schema";
import { newId, nowIso } from "@/lib/http";
import {
  buildPreferenceProfile,
  categorize,
  scoreCandidate,
  type CandidateTitle,
  type RatedSample,
  type ScoredRecommendation,
} from "./engine";

type TitleRelation =
  | "none"
  | "not_watched"
  | "watchlist"
  | "watched"
  | "watching"
  | "dropped";

type CatalogRow = {
  id: string;
  kind: string;
  releaseYear: number | null;
  runtimeMinutes: number | null;
  externalRating: number | null;
  externalRatingSource: string | null;
  genres: string | null;
  directors: string | null;
  actors: string | null;
  relation: string | null;
};

async function loadCatalogRows(): Promise<CatalogRow[]> {
  const db = getDb();

  const rows = await db.all<CatalogRow>(sql`
    select
      t.id as id,
      t.kind as kind,
      t.release_year as releaseYear,
      t.runtime_minutes as runtimeMinutes,
      t.external_rating as externalRating,
      t.external_rating_source as externalRatingSource,
      (select group_concat(g.slug, '|')
         from title_genres tg join genres g on g.id = tg.genre_id
        where tg.title_id = t.id) as genres,
      (select group_concat(p.name, '|')
         from credits c join people p on p.id = c.person_id
        where c.title_id = t.id and c.role = 'director') as directors,
      (select group_concat(p.name, '|')
         from credits c join people p on p.id = c.person_id
        where c.title_id = t.id and c.role = 'actor') as actors
    from titles t
    where t.kind in ('movie', 'series')
  `);

  return rows;
}

function splitList(value: string | null): string[] {
  if (!value) return [];
  return value.split("|").filter(Boolean);
}

export async function generateRecommendations(
  userId: string,
): Promise<{
  profile: {
    ratedCount: number;
    ratingMean: number | null;
    confidence: number;
  };
  safe: ScoredRecommendation[];
  discovery: ScoredRecommendation[];
  excludedCount: number;
  reasonsWithoutData: string[];
}> {
  const db = getDb();

  const relationRows = await db
    .select({
      titleId: libraryEntries.titleId,
      status: libraryEntries.status,
      rating: libraryEntries.rating,
    })
    .from(libraryEntries)
    .where(eq(libraryEntries.userId, userId));

  const relationMap = new Map(
    relationRows.map((row) => [row.titleId, row] as const),
  );

  const catalog = await loadCatalogRows();

  const samples: RatedSample[] = [];
  for (const row of catalog) {
    const relation = relationMap.get(row.id);
    if (!relation || relation.rating === null) continue;
    if (row.kind !== "movie" && row.kind !== "series") continue;
    samples.push({
      titleId: row.id,
      rating: relation.rating,
      genres: splitList(row.genres),
      directors: splitList(row.directors),
      actors: splitList(row.actors),
      releaseYear: row.releaseYear,
      kind: row.kind,
      runtimeMinutes: row.runtimeMinutes,
    });
  }

  const profile = buildPreferenceProfile(samples);
  const reasonsWithoutData: string[] = [];

  const feedbackRows = await db
    .select({ titleId: recommendationFeedback.titleId, verdict: recommendationFeedback.verdict })
    .from(recommendationFeedback)
    .where(eq(recommendationFeedback.userId, userId));

  const rejected = new Set(
    feedbackRows.filter((row) => row.verdict === "not_interested").map((row) => row.titleId),
  );

  const candidates: ScoredRecommendation[] = [];

  for (const row of catalog) {
    if (row.kind !== "movie" && row.kind !== "series") continue;
    if (rejected.has(row.id)) continue;

    const relation = relationMap.get(row.id);
    const relationStatus = (relation?.status ?? "none") as TitleRelation;

    const candidate: CandidateTitle = {
      titleId: row.id,
      genres: splitList(row.genres),
      directors: splitList(row.directors),
      actors: splitList(row.actors),
      releaseYear: row.releaseYear,
      kind: row.kind,
      runtimeMinutes: row.runtimeMinutes,
      externalRating: row.externalRating,
      externalRatingSource: row.externalRatingSource,
      userRelation: relationStatus,
    };

    // Izlenmis / izleniyor / yarim birakilmis yapimlar onerilmez.
    if (
      relationStatus === "watched" ||
      relationStatus === "watching" ||
      relationStatus === "dropped"
    ) {
      continue;
    }
    // Izleme listesindekiler de zaten kesfedilmis sayilir.
    if (relationStatus === "watchlist") continue;

    if (profile.ratedCount === 0) {
      // Puan yoksa kisisel oneri uretilemez; yalnizca acikca etiketli
      // "veri yok" durumu dondurulur.
      continue;
    }

    const scored = scoreCandidate(candidate, profile);
    if (scored.reasons.length === 0) continue;
    if (scored.score <= 0) continue;

    candidates.push(scored);
  }

  if (profile.ratedCount === 0) {
    reasonsWithoutData.push(
      "Henüz hiçbir yapıma puan vermediniz. Kişisel öneri üretmek için en az birkaç yapımı puanlamanız gerekiyor.",
    );
  } else if (candidates.length === 0) {
    reasonsWithoutData.push(
      "Katalogda önerilebilecek yeni yapım bulunamadı. Arama sayfasından farklı yapımlar ekleyerek aday havuzunu genişletebilirsiniz.",
    );
  }

  const categorized = categorize(candidates).slice(0, 40);

  // Sonuclari veritabanina yaz (yeniden uretilebilir; eski kayitlar guncellenir).
  const now = nowIso();
  await db.delete(recommendations).where(eq(recommendations.userId, userId));
  if (categorized.length > 0) {
    await db.insert(recommendations).values(
      categorized.map((item) => ({
        id: newId("rec"),
        userId,
        titleId: item.titleId,
        kind: item.kind,
        score: item.score,
        confidence: item.confidence,
        uncertaintyNote: item.uncertaintyNote,
        reasonsJson: JSON.stringify(item.reasons),
        algorithm: "rules-v1",
        createdAt: now,
      })),
    );
  }

  return {
    profile: {
      ratedCount: profile.ratedCount,
      ratingMean: profile.ratingMean,
      confidence:
        profile.ratedCount === 0
          ? 0
          : Math.min(1, Math.log10(profile.ratedCount + 1) / Math.log10(21)),
    },
    safe: categorized.filter((item) => item.kind === "safe"),
    discovery: categorized.filter((item) => item.kind === "discovery"),
    excludedCount: relationRows.length,
    reasonsWithoutData,
  };
}

export async function listRecommendationViews(userId: string) {
  const db = getDb();

  const rows = await db
    .select({
      rec: recommendations,
      title: titles,
    })
    .from(recommendations)
    .innerJoin(titles, eq(recommendations.titleId, titles.id))
    .where(eq(recommendations.userId, userId))
    .orderBy(desc(recommendations.score));

  const titleIds = rows.map((row) => row.title.id);
  const genreMap = new Map<string, string[]>();

  if (titleIds.length > 0) {
    const genreRows = await db.all<{ title_id: string; name_tr: string }>(sql`
      select tg.title_id as title_id, g.name_tr as name_tr
      from title_genres tg join genres g on g.id = tg.genre_id
      where tg.title_id in (${sql.join(
        titleIds.map((id) => sql`${id}`),
        sql`, `,
      )})
    `);
    for (const row of genreRows) {
      const list = genreMap.get(row.title_id) ?? [];
      list.push(row.name_tr);
      genreMap.set(row.title_id, list);
    }
  }

  return rows.map((row) => ({
    id: row.rec.id,
    titleId: row.title.id,
    kind: row.rec.kind,
    score: row.rec.score,
    confidence: row.rec.confidence,
    uncertaintyNote: row.rec.uncertaintyNote,
    reasons: JSON.parse(row.rec.reasonsJson) as {
      factor: string;
      contribution: number;
      detail: string;
    }[],
    title: {
      originalTitle: row.title.originalTitle,
      localizedTitle: row.title.localizedTitle,
      releaseYear: row.title.releaseYear,
      posterUrl: row.title.posterUrl,
      kind: row.title.kind,
      externalRating: row.title.externalRating,
    },
    genres: genreMap.get(row.title.id) ?? [],
  }));
}

export async function saveRecommendationFeedback(
  userId: string,
  titleId: string,
  verdict: "liked" | "not_interested" | "saved" | "watched",
  note?: string,
) {
  const db = getDb();
  await db
    .insert(recommendationFeedback)
    .values({
      id: newId("rfb"),
      userId,
      titleId,
      verdict,
      note: note ?? null,
    })
    .onConflictDoUpdate({
      target: [
        recommendationFeedback.userId,
        recommendationFeedback.titleId,
        recommendationFeedback.verdict,
      ],
      set: { note: note ?? null },
    });

  if (verdict === "not_interested") {
    await db
      .delete(recommendations)
      .where(
        and(
          eq(recommendations.userId, userId),
          eq(recommendations.titleId, titleId),
        ),
      );
  }
}
