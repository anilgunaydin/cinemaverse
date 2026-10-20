import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { libraryEntries } from "@/lib/db/schema";
import { getTitleDetail } from "@/lib/catalog/service";
import { getCurrentUser } from "@/lib/auth/current-user";

export async function loadTitlePageData(titleId: string, userId?: string) {
  const detail = await getTitleDetail(titleId);
  if (!detail) return null;

  const db = getDb();

  const ratingRow = await db
    .select({
      avg: sql<number | null>`avg(${libraryEntries.rating})`,
      count: sql<number>`count(${libraryEntries.rating})`,
    })
    .from(libraryEntries)
    .where(
      and(
        eq(libraryEntries.titleId, titleId),
        sql`${libraryEntries.rating} is not null`,
      ),
    );

  let userEntry = null;
  if (userId) {
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
    userEntry = rows[0] ?? null;
  }

  return {
    ...detail,
    communityRating: {
      average: ratingRow[0]?.avg ?? null,
      count: Number(ratingRow[0]?.count ?? 0),
    },
    userEntry,
  };
}

export async function getCurrentUserSafe() {
  return getCurrentUser();
}
