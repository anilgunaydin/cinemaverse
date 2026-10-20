import "server-only";

import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  libraryEntries,
  reviews,
  titles,
  users,
  WATCH_STATUSES,
  type WatchStatus,
} from "@/lib/db/schema";
import { contentHash, newId, nowIso } from "@/lib/http";
import { upsertLibraryEntry } from "@/lib/library/service";
import { toCsv } from "./csv";
import { buildTitleIndex, resolveTitleId, type TitleIndexEntry } from "./matching";
import {
  EXPORT_FORMAT,
  EXPORT_VERSION,
  type ExportLibraryEntry,
  type ExportPayload,
  type ExportReviewEntry,
  type ImportSummary,
} from "./types";

async function loadTitleIndexEntries(): Promise<TitleIndexEntry[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: titles.id,
      originalTitle: titles.originalTitle,
      localizedTitle: titles.localizedTitle,
      releaseYear: titles.releaseYear,
      kind: titles.kind,
      imdbId: titles.imdbId,
      tmdbId: titles.tmdbId,
      tvmazeId: titles.tvmazeId,
      wikidataId: titles.wikidataId,
    })
    .from(titles);
  return rows;
}

export async function exportUserData(userId: string): Promise<ExportPayload> {
  const db = getDb();

  const libraryRows = await db
    .select({ entry: libraryEntries, title: titles })
    .from(libraryEntries)
    .innerJoin(titles, eq(libraryEntries.titleId, titles.id))
    .where(eq(libraryEntries.userId, userId));

  const reviewRows = await db
    .select({ review: reviews, title: titles })
    .from(reviews)
    .innerJoin(titles, eq(reviews.titleId, titles.id))
    .where(eq(reviews.userId, userId));

  const library: ExportLibraryEntry[] = libraryRows.map(({ entry, title }) => ({
    imdbId: title.imdbId,
    tmdbId: title.tmdbId,
    tvmazeId: title.tvmazeId,
    wikidataId: title.wikidataId,
    titleName: title.localizedTitle ?? title.originalTitle,
    releaseYear: title.releaseYear,
    kind: title.kind,
    status: entry.status,
    rating: entry.rating,
    watchedAt: entry.watchedAt,
    watchedPeriod: entry.watchedPeriod,
    notes: entry.notes,
    likedAspects: entry.likedAspects,
    dislikedAspects: entry.dislikedAspects,
    memorableScenes: entry.memorableScenes,
    rewatchIntent: entry.rewatchIntent,
    progressSeason: entry.progressSeason,
    progressEpisode: entry.progressEpisode,
    isFavorite: entry.isFavorite,
  }));

  const reviewEntries: ExportReviewEntry[] = reviewRows.map(({ review, title }) => ({
    titleName: title.localizedTitle ?? title.originalTitle,
    releaseYear: title.releaseYear,
    imdbId: title.imdbId,
    body: review.body,
    rating: review.rating,
    containsSpoiler: review.containsSpoiler,
    visibility: review.visibility,
    createdAt: review.createdAt,
  }));

  // Kullanici bilgisi (yalnizca kullanicinin kendi verisi).
  const userRows = await db
    .select({ displayName: users.displayName, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: nowIso(),
    user: {
      displayName: userRows[0]?.displayName ?? "",
      email: userRows[0]?.email ?? "",
    },
    library,
    reviews: reviewEntries,
  };
}

export async function exportLibraryCsv(userId: string): Promise<string> {
  const payload = await exportUserData(userId);
  return toCsv(
    payload.library.map((entry) => ({ ...entry })),
    [
      "titleName",
      "releaseYear",
      "kind",
      "imdbId",
      "tmdbId",
      "tvmazeId",
      "wikidataId",
      "status",
      "rating",
      "watchedAt",
      "watchedPeriod",
      "isFavorite",
      "progressSeason",
      "progressEpisode",
      "rewatchIntent",
      "notes",
    ],
  );
}

function isValidStatus(value: unknown): value is WatchStatus {
  return typeof value === "string" && (WATCH_STATUSES as readonly string[]).includes(value);
}

export async function importLibraryEntries(
  userId: string,
  entries: ExportLibraryEntry[],
): Promise<{ imported: number; skipped: { titleName: string; reason: string }[] }> {
  return importLibraryDetailed(userId, entries);
}

async function importLibraryDetailed(
  userId: string,
  entries: ExportLibraryEntry[],
): Promise<{ imported: number; skipped: { titleName: string; reason: string }[] }> {
  const index = buildTitleIndex(await loadTitleIndexEntries());
  const skipped: { titleName: string; reason: string }[] = [];
  let imported = 0;

  for (const entry of entries) {
    if (!entry.titleName || !isValidStatus(entry.status)) {
      skipped.push({ titleName: entry.titleName ?? "(isimsiz)", reason: "Geçersiz kayıt." });
      continue;
    }
    const { titleId, method } = resolveTitleId(entry, index);
    if (!titleId) {
      skipped.push({
        titleName: entry.titleName,
        reason: "Katalogda eşleşen yapım yok. Önce arama ile yapımı ekleyin.",
      });
      continue;
    }
    void method;
    await upsertLibraryEntry(userId, {
      titleId,
      status: entry.status,
      rating: entry.rating,
      watchedAt: entry.watchedAt,
      watchedPeriod: entry.watchedPeriod,
      notes: entry.notes,
      likedAspects: entry.likedAspects,
      dislikedAspects: entry.dislikedAspects,
      memorableScenes: entry.memorableScenes,
      rewatchIntent: entry.rewatchIntent,
      progressSeason: entry.progressSeason,
      progressEpisode: entry.progressEpisode,
      isFavorite: entry.isFavorite,
    });
    imported += 1;
  }

  return { imported, skipped };
}

export async function importUserData(
  userId: string,
  library: ExportLibraryEntry[],
  reviewEntries: ExportReviewEntry[],
): Promise<ImportSummary> {
  const db = getDb();
  const index = buildTitleIndex(await loadTitleIndexEntries());

  const libraryResult = await importLibraryDetailed(userId, library);

  const reviewsSkipped: { titleName: string; reason: string }[] = [];
  let reviewsImported = 0;

  for (const entry of reviewEntries) {
    const body = (entry.body ?? "").trim();
    if (!body) {
      reviewsSkipped.push({ titleName: entry.titleName, reason: "Boş inceleme." });
      continue;
    }
    const { titleId } = resolveTitleId(
      {
        imdbId: entry.imdbId ?? null,
        tmdbId: null,
        tvmazeId: null,
        wikidataId: null,
        titleName: entry.titleName,
        releaseYear: entry.releaseYear,
        kind: "",
        status: "watched",
        rating: entry.rating,
        watchedAt: null,
        watchedPeriod: null,
        notes: null,
        likedAspects: null,
        dislikedAspects: null,
        memorableScenes: null,
        rewatchIntent: null,
        progressSeason: null,
        progressEpisode: null,
        isFavorite: false,
      },
      index,
    );
    if (!titleId) {
      reviewsSkipped.push({
        titleName: entry.titleName,
        reason: "Katalogda eşleşen yapım yok.",
      });
      continue;
    }

    // Ayni kullanicinin ayni yapim icin ayni metni tekrar eklemesini onle.
    const existing = await db
      .select({ id: reviews.id, body: reviews.body })
      .from(reviews)
      .where(and(eq(reviews.userId, userId), eq(reviews.titleId, titleId)));
    const hash = contentHash(body);
    if (existing.some((row) => contentHash(row.body) === hash)) {
      reviewsSkipped.push({ titleName: entry.titleName, reason: "Aynı inceleme zaten var." });
      continue;
    }

    const now = nowIso();
    await db.insert(reviews).values({
      id: newId("rev"),
      userId,
      titleId,
      body,
      rating: entry.rating,
      containsSpoiler: Boolean(entry.containsSpoiler),
      visibility: entry.visibility ?? "public",
      createdAt: entry.createdAt ?? now,
      updatedAt: now,
    });
    reviewsImported += 1;
  }

  return {
    libraryImported: libraryResult.imported,
    librarySkipped: libraryResult.skipped,
    reviewsImported,
    reviewsSkipped,
  };
}
