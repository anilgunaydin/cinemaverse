import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { libraryEntries, reviews, titles, users } from "@/lib/db/schema";
import { newId, nowIso, sanitizePlainText } from "@/lib/http";

export type ReviewVisibility = "private" | "followers" | "public";

export type ReviewInput = {
  titleId: string;
  body: string;
  rating?: number | null;
  containsSpoiler?: boolean;
  spoilerScopeSeason?: number | null;
  visibility?: ReviewVisibility;
};

export type ReviewView = {
  id: string;
  titleId: string;
  titleName: string;
  releaseYear: number | null;
  posterUrl: string | null;
  authorId: string;
  authorName: string;
  body: string;
  rating: number | null;
  containsSpoiler: boolean;
  spoilerScopeSeason: number | null;
  visibility: ReviewVisibility;
  createdAt: string;
  updatedAt: string;
};

/** Kullanicinin bir yapim icin incelemesini olusturur veya gunceller. */
export async function upsertReview(
  userId: string,
  input: ReviewInput,
): Promise<{ id: string; created: boolean }> {
  const db = getDb();
  const now = nowIso();
  const body = sanitizePlainText(input.body).slice(0, 10000);

  const existing = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(and(eq(reviews.userId, userId), eq(reviews.titleId, input.titleId)))
    .limit(1);

  if (existing[0]) {
    await db
      .update(reviews)
      .set({
        body,
        rating: input.rating ?? null,
        containsSpoiler: input.containsSpoiler ?? false,
        spoilerScopeSeason: input.spoilerScopeSeason ?? null,
        visibility: input.visibility ?? "public",
        updatedAt: now,
      })
      .where(eq(reviews.id, existing[0].id));
    return { id: existing[0].id, created: false };
  }

  const id = newId("rev");
  await db.insert(reviews).values({
    id,
    userId,
    titleId: input.titleId,
    body,
    rating: input.rating ?? null,
    containsSpoiler: input.containsSpoiler ?? false,
    spoilerScopeSeason: input.spoilerScopeSeason ?? null,
    visibility: input.visibility ?? "public",
    createdAt: now,
    updatedAt: now,
  });
  return { id, created: true };
}

export async function deleteReview(
  userId: string,
  reviewId: string,
): Promise<boolean> {
  const db = getDb();
  const result = await db
    .delete(reviews)
    .where(and(eq(reviews.id, reviewId), eq(reviews.userId, userId)));
  return result.changes > 0;
}

function toView(row: {
  review: typeof reviews.$inferSelect;
  title: typeof titles.$inferSelect;
  authorName: string | null;
}): ReviewView {
  return {
    id: row.review.id,
    titleId: row.review.titleId,
    titleName: row.title.localizedTitle ?? row.title.originalTitle,
    releaseYear: row.title.releaseYear,
    posterUrl: row.title.posterUrl,
    authorId: row.review.userId,
    authorName: row.authorName ?? "Kullanıcı",
    body: row.review.body,
    rating: row.review.rating,
    containsSpoiler: row.review.containsSpoiler,
    spoilerScopeSeason: row.review.spoilerScopeSeason,
    visibility: row.review.visibility,
    createdAt: row.review.createdAt,
    updatedAt: row.review.updatedAt,
  };
}

/** Bir yapim icin gorunur incelemeler. `viewerId` kendi gizli incelemesini de gorur. */
export async function listReviewsForTitle(
  titleId: string,
  viewerId?: string,
): Promise<ReviewView[]> {
  const db = getDb();
  const rows = await db
    .select({ review: reviews, title: titles, authorName: users.displayName })
    .from(reviews)
    .innerJoin(titles, eq(reviews.titleId, titles.id))
    .innerJoin(users, eq(reviews.userId, users.id))
    .where(
      and(
        eq(reviews.titleId, titleId),
        eq(reviews.moderationStatus, "visible"),
        viewerId
          ? undefined
          : eq(reviews.visibility, "public"),
      ),
    )
    .orderBy(desc(reviews.createdAt))
    .limit(50);

  return rows
    .filter(
      (row) =>
        row.review.visibility === "public" || row.review.userId === viewerId,
    )
    .map(toView);
}

/** Topluluk akisi: tum kullanicilarin herkese acik incelemeleri. */
export async function listPublicReviews(limit = 30): Promise<ReviewView[]> {
  const db = getDb();
  const rows = await db
    .select({ review: reviews, title: titles, authorName: users.displayName })
    .from(reviews)
    .innerJoin(titles, eq(reviews.titleId, titles.id))
    .innerJoin(users, eq(reviews.userId, users.id))
    .where(
      and(eq(reviews.visibility, "public"), eq(reviews.moderationStatus, "visible")),
    )
    .orderBy(desc(reviews.createdAt))
    .limit(Math.min(Math.max(limit, 1), 100));

  return rows.map(toView);
}

/** Kullanicinin kendi incelemeleri. */
export async function listUserReviews(
  userId: string,
  limit = 50,
): Promise<ReviewView[]> {
  const db = getDb();
  const rows = await db
    .select({ review: reviews, title: titles, authorName: users.displayName })
    .from(reviews)
    .innerJoin(titles, eq(reviews.titleId, titles.id))
    .innerJoin(users, eq(reviews.userId, users.id))
    .where(eq(reviews.userId, userId))
    .orderBy(desc(reviews.createdAt))
    .limit(Math.min(Math.max(limit, 1), 100));
  return rows.map(toView);
}

/** Kullanicinin puan verdigi yapim sayisini ve benzer ozetleri doner. */
export async function getUserProfileSummary(userId: string) {
  const db = getDb();
  const rows = await db
    .select({
      titleId: libraryEntries.titleId,
      status: libraryEntries.status,
      rating: libraryEntries.rating,
    })
    .from(libraryEntries)
    .where(eq(libraryEntries.userId, userId));

  const titleIds = rows.map((row) => row.titleId);
  const ratingValues = rows
    .map((row) => row.rating)
    .filter((value): value is number => typeof value === "number");

  const reviewRows = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(eq(reviews.userId, userId));

  return {
    libraryCount: rows.length,
    ratedCount: ratingValues.length,
    averageRating:
      ratingValues.length > 0
        ? ratingValues.reduce((sum, value) => sum + value, 0) / ratingValues.length
        : null,
    reviewCount: reviewRows.length,
    knownTitleIds: titleIds.length,
  };
}

/** Yalnizca ic (dogrulama) kullanim: verilen basliklarin var oldugunu kontrol eder. */
export async function titlesExist(titleIds: string[]): Promise<Set<string>> {
  if (titleIds.length === 0) return new Set();
  const db = getDb();
  const rows = await db
    .select({ id: titles.id })
    .from(titles)
    .where(inArray(titles.id, titleIds));
  return new Set(rows.map((row) => row.id));
}
