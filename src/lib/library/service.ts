import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  libraryEntries,
  titles,
  WATCH_STATUSES,
  type WatchStatus,
} from "@/lib/db/schema";
import { newId, nowIso } from "@/lib/http";
import { WATCH_STATUS_LABELS, REWATCH_LABELS } from "@/lib/library/labels";

export { WATCH_STATUS_LABELS, REWATCH_LABELS };

export type LibraryEntryInput = {
  titleId: string;
  status?: WatchStatus;
  rating?: number | null;
  watchedAt?: string | null;
  watchedPeriod?: string | null;
  notes?: string | null;
  likedAspects?: string | null;
  dislikedAspects?: string | null;
  memorableScenes?: string | null;
  rewatchIntent?: "yes" | "maybe" | "no" | null;
  progressSeason?: number | null;
  progressEpisode?: number | null;
  isFavorite?: boolean;
};

export type LibraryEntryView = {
  entryId: string;
  titleId: string;
  kind: string;
  originalTitle: string;
  localizedTitle: string | null;
  releaseYear: number | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  trailerUrl: string | null;
  overview: string | null;
  status: WatchStatus;
  rating: number | null;
  watchedAt: string | null;
  watchedPeriod: string | null;
  notes: string | null;
  likedAspects: string | null;
  dislikedAspects: string | null;
  memorableScenes: string | null;
  rewatchIntent: "yes" | "maybe" | "no" | null;
  progressSeason: number | null;
  progressEpisode: number | null;
  isFavorite: boolean;
  updatedAt: string;
  genres: string[];
};

export async function upsertLibraryEntry(
  userId: string,
  input: LibraryEntryInput,
): Promise<{ id: string; created: boolean }> {
  const db = getDb();
  const now = nowIso();

  const existing = await db
    .select({ id: libraryEntries.id })
    .from(libraryEntries)
    .where(
      and(
        eq(libraryEntries.userId, userId),
        eq(libraryEntries.titleId, input.titleId),
      ),
    )
    .limit(1);

  const values = {
    status: input.status,
    rating: input.rating,
    watchedAt: input.watchedAt,
    watchedPeriod: input.watchedPeriod,
    notes: input.notes,
    likedAspects: input.likedAspects,
    dislikedAspects: input.dislikedAspects,
    memorableScenes: input.memorableScenes,
    rewatchIntent: input.rewatchIntent,
    progressSeason: input.progressSeason,
    progressEpisode: input.progressEpisode,
    isFavorite: input.isFavorite,
    updatedAt: now,
  };

  // Tanimsiz alanlar mevcut degeri ezmez.
  const cleaned = Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  );

  if (existing[0]) {
    await db
      .update(libraryEntries)
      .set(cleaned)
      .where(eq(libraryEntries.id, existing[0].id));
    return { id: existing[0].id, created: false };
  }

  const id = newId("lib");
  await db.insert(libraryEntries).values({
    id,
    userId,
    titleId: input.titleId,
    status: input.status ?? "not_watched",
    createdAt: now,
    updatedAt: now,
    ...cleaned,
  });
  return { id, created: true };
}

export async function deleteLibraryEntry(
  userId: string,
  entryId: string,
): Promise<boolean> {
  const db = getDb();
  const result = await db
    .delete(libraryEntries)
    .where(
      and(eq(libraryEntries.id, entryId), eq(libraryEntries.userId, userId)),
    );
  return result.changes > 0;
}

export async function getLibraryEntryForTitle(
  userId: string,
  titleId: string,
) {
  const db = getDb();
  const rows = await db
    .select()
    .from(libraryEntries)
    .where(
      and(
        eq(libraryEntries.userId, userId),
        eq(libraryEntries.titleId, titleId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function listLibrary(
  userId: string,
  options?: { status?: WatchStatus; limit?: number; offset?: number },
): Promise<{ items: LibraryEntryView[]; total: number }> {
  const db = getDb();
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
  const offset = Math.max(options?.offset ?? 0, 0);

  const conditions = [eq(libraryEntries.userId, userId)];
  if (options?.status) {
    conditions.push(eq(libraryEntries.status, options.status));
  }
  const whereClause = and(...conditions);

  const rows = await db
    .select({
      entry: libraryEntries,
      title: titles,
    })
    .from(libraryEntries)
    .innerJoin(titles, eq(libraryEntries.titleId, titles.id))
    .where(whereClause)
    .orderBy(desc(libraryEntries.updatedAt))
    .limit(limit)
    .offset(offset);

  const countRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(libraryEntries)
    .where(whereClause);

  const titleIds = rows.map((row) => row.title.id);
  const genreMap = new Map<string, string[]>();

  if (titleIds.length > 0) {
    const genreRows = await db.all<{ title_id: string; name_tr: string }>(
      sql`select tg.title_id as title_id, g.name_tr as name_tr
          from title_genres tg
          join genres g on g.id = tg.genre_id
          where tg.title_id in (${sql.join(
            titleIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
    );
    for (const row of genreRows) {
      const list = genreMap.get(row.title_id) ?? [];
      list.push(row.name_tr);
      genreMap.set(row.title_id, list);
    }
  }

  const items: LibraryEntryView[] = rows.map((row) => ({
    entryId: row.entry.id,
    titleId: row.title.id,
    kind: row.title.kind,
    originalTitle: row.title.originalTitle,
    localizedTitle: row.title.localizedTitle,
    releaseYear: row.title.releaseYear,
    posterUrl: row.title.posterUrl,
    backdropUrl: row.title.backdropUrl,
    trailerUrl: row.title.trailerUrl,
    overview: row.title.overview,
    status: row.entry.status,
    rating: row.entry.rating,
    watchedAt: row.entry.watchedAt,
    watchedPeriod: row.entry.watchedPeriod,
    notes: row.entry.notes,
    likedAspects: row.entry.likedAspects,
    dislikedAspects: row.entry.dislikedAspects,
    memorableScenes: row.entry.memorableScenes,
    rewatchIntent: row.entry.rewatchIntent,
    progressSeason: row.entry.progressSeason,
    progressEpisode: row.entry.progressEpisode,
    isFavorite: row.entry.isFavorite,
    updatedAt: row.entry.updatedAt,
    genres: genreMap.get(row.title.id) ?? [],
  }));

  return { items, total: Number(countRows[0]?.count ?? 0) };
}

export async function getLibraryStats(userId: string) {
  const db = getDb();
  const rows = await db
    .select({
      status: libraryEntries.status,
      count: sql<number>`count(*)`,
    })
    .from(libraryEntries)
    .where(eq(libraryEntries.userId, userId))
    .groupBy(libraryEntries.status);

  const byStatus = Object.fromEntries(
    WATCH_STATUSES.map((status) => [status, 0]),
  ) as Record<WatchStatus, number>;

  for (const row of rows) {
    byStatus[row.status] = Number(row.count);
  }

  const ratingRow = await db
    .select({
      avg: sql<number | null>`avg(${libraryEntries.rating})`,
      count: sql<number>`count(${libraryEntries.rating})`,
    })
    .from(libraryEntries)
    .where(eq(libraryEntries.userId, userId));

  return {
    byStatus,
    total: Object.values(byStatus).reduce((sum, value) => sum + value, 0),
    averageRating: ratingRow[0]?.avg ?? null,
    ratedCount: Number(ratingRow[0]?.count ?? 0),
  };
}

/** Kullanicinin puanladigi yapimlar (oneriler icin). */
export async function listRatedTitles(userId: string) {
  const db = getDb();
  return db
    .select({
      titleId: libraryEntries.titleId,
      rating: libraryEntries.rating,
      status: libraryEntries.status,
      notes: libraryEntries.notes,
      title: titles,
    })
    .from(libraryEntries)
    .innerJoin(titles, eq(libraryEntries.titleId, titles.id))
    .where(
      and(
        eq(libraryEntries.userId, userId),
        sql`${libraryEntries.rating} is not null`,
      ),
    );
}

export async function listUserTitleIds(userId: string): Promise<Set<string>> {
  const db = getDb();
  const rows = await db
    .select({ titleId: libraryEntries.titleId })
    .from(libraryEntries)
    .where(
      and(
        eq(libraryEntries.userId, userId),
        inArray(libraryEntries.status, [
          "watched",
          "watching",
          "dropped",
          "watchlist",
        ]),
      ),
    );
  return new Set(rows.map((row) => row.titleId));
}
