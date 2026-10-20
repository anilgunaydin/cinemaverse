import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  franchiseTitles,
  franchises,
  titles,
} from "@/lib/db/schema";
import { newId, nowIso, sanitizePlainText } from "@/lib/http";

export type FranchiseInput = {
  name: string;
  wikidataId?: string | null;
};

export type FranchiseView = {
  id: string;
  name: string;
  wikidataId: string | null;
  createdAt: string;
  titleCount: number;
};

export type FranchiseDetail = FranchiseView & {
  titles: FranchiseTitleView[];
};

export type FranchiseTitleView = {
  id: string;
  titleId: string;
  titleName: string;
  originalTitle: string;
  releaseYear: number | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  trailerUrl: string | null;
  kind: string;
  order: number | null;
};

/** Yeni franchise oluştur. */
export async function createFranchise(
  input: FranchiseInput,
): Promise<{ id: string }> {
  const db = getDb();
  const now = nowIso();
  const name = sanitizePlainText(input.name).slice(0, 200);
  const id = newId("frn");

  await db.insert(franchises).values({
    id,
    name,
    wikidataId: input.wikidataId ?? null,
    createdAt: now,
  });

  return { id };
}

/** Franchise detayını (yapımlarla birlikte) getir. */
export async function getFranchiseDetail(
  franchiseId: string,
): Promise<FranchiseDetail | null> {
  const db = getDb();

  const rows = await db
    .select({ franchise: franchises })
    .from(franchises)
    .where(eq(franchises.id, franchiseId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const titleRows = await db
    .select({ title: titles })
    .from(franchiseTitles)
    .innerJoin(titles, eq(titles.id, franchiseTitles.titleId))
    .where(eq(franchiseTitles.franchiseId, franchiseId))
    .orderBy(sql`${titles.releaseYear} asc nulls last, ${titles.originalTitle} asc`)
    .limit(200);

  const titles_view: FranchiseTitleView[] = titleRows.map((r, idx) => ({
    id: `${r.title.id}`,
    titleId: r.title.id,
    titleName: r.title.localizedTitle ?? r.title.originalTitle,
    originalTitle: r.title.originalTitle,
    releaseYear: r.title.releaseYear,
    posterUrl: r.title.posterUrl,
    backdropUrl: r.title.backdropUrl,
    trailerUrl: r.title.trailerUrl,
    kind: r.title.kind,
    order: idx + 1,
  }));

  return {
    id: row.franchise.id,
    name: row.franchise.name,
    wikidataId: row.franchise.wikidataId,
    createdAt: row.franchise.createdAt,
    titleCount: titles_view.length,
    titles: titles_view,
  };
}

/** Tüm franchise'leri listele. */
export async function listFranchises(limit = 50): Promise<FranchiseView[]> {
  const db = getDb();

  const rows = await db
    .select({ franchise: franchises })
    .from(franchises)
    .orderBy(desc(franchises.createdAt))
    .limit(Math.min(Math.max(limit, 1), 200));

  const ids = rows.map((r) => r.franchise.id);
  const countMap = new Map<string, number>();
  if (ids.length > 0) {
    const counts = await db
      .select({
        franchiseId: franchiseTitles.franchiseId,
        count: sql<number>`count(*)`,
      })
      .from(franchiseTitles)
      .where(inArray(franchiseTitles.franchiseId, ids))
      .groupBy(franchiseTitles.franchiseId);
    for (const item of counts) {
      countMap.set(item.franchiseId, Number(item.count));
    }
  }

  return rows.map((row) => ({
    id: row.franchise.id,
    name: row.franchise.name,
    wikidataId: row.franchise.wikidataId,
    createdAt: row.franchise.createdAt,
    titleCount: countMap.get(row.franchise.id) ?? 0,
  }));
}

/** Belirli bir başlığın ait olduğu franchise'leri getir. */
export async function getFranchisesForTitle(
  titleId: string,
): Promise<FranchiseView[]> {
  const db = getDb();

  const rows = await db
    .select({ franchise: franchises })
    .from(franchiseTitles)
    .innerJoin(franchises, eq(franchises.id, franchiseTitles.franchiseId))
    .where(eq(franchiseTitles.titleId, titleId))
    .orderBy(franchises.name);

  return rows.map((row) => ({
    id: row.franchise.id,
    name: row.franchise.name,
    wikidataId: row.franchise.wikidataId,
    createdAt: row.franchise.createdAt,
    titleCount: 0,
  }));
}

/** Franchise'ye başlık ekle. */
export async function addTitleToFranchise(
  franchiseId: string,
  titleId: string,
): Promise<{ ok: true } | { ok: false; reason: "not_found" | "already" }> {
  const db = getDb();

  const frRows = await db
    .select({ id: franchises.id })
    .from(franchises)
    .where(eq(franchises.id, franchiseId))
    .limit(1);
  if (!frRows[0]) return { ok: false, reason: "not_found" };

  const titleRows = await db
    .select({ id: titles.id })
    .from(titles)
    .where(eq(titles.id, titleId))
    .limit(1);
  if (!titleRows[0]) return { ok: false, reason: "not_found" };

  const existing = await db
    .select()
    .from(franchiseTitles)
    .where(
      and(
        eq(franchiseTitles.franchiseId, franchiseId),
        eq(franchiseTitles.titleId, titleId),
      ),
    )
    .limit(1);
  if (existing[0]) return { ok: false, reason: "already" };

  await db.insert(franchiseTitles).values({
    franchiseId,
    titleId,
  });

  return { ok: true };
}

/** Franchise'den başlık kaldır. */
export async function removeTitleFromFranchise(
  franchiseId: string,
  titleId: string,
): Promise<boolean> {
  const db = getDb();
  const result = await db
    .delete(franchiseTitles)
    .where(
      and(
        eq(franchiseTitles.franchiseId, franchiseId),
        eq(franchiseTitles.titleId, titleId),
      ),
    );
  return result.changes > 0;
}

/** Franchise güncelle (ad, wikidataId). */
export async function updateFranchise(
  franchiseId: string,
  input: Partial<FranchiseInput>,
): Promise<{ ok: true } | { ok: false; reason: "not_found" }> {
  const db = getDb();

  const rows = await db
    .select({ id: franchises.id })
    .from(franchises)
    .where(eq(franchises.id, franchiseId))
    .limit(1);
  if (!rows[0]) return { ok: false, reason: "not_found" };

  const updates: Record<string, unknown> = {};
  if (input.name !== undefined)
    updates.name = sanitizePlainText(input.name).slice(0, 200);
  if (input.wikidataId !== undefined)
    updates.wikidataId = input.wikidataId;

  if (Object.keys(updates).length > 0) {
    await db.update(franchises).set(updates).where(eq(franchises.id, franchiseId));
  }
  return { ok: true };
}

/** Franchise sil (bağlı başlıklar da cascade ile gider). */
export async function deleteFranchise(franchiseId: string): Promise<boolean> {
  const db = getDb();
  await db
    .delete(franchiseTitles)
    .where(eq(franchiseTitles.franchiseId, franchiseId));
  const result = await db
    .delete(franchises)
    .where(eq(franchises.id, franchiseId));
  return result.changes > 0;
}

/** Wikidata ID'si verilen franchise'i getir veya oluştur. */
export async function getOrCreateFranchiseByWikidata(
  wikidataId: string,
  name: string,
): Promise<{ id: string; created: boolean }> {
  const db = getDb();

  const existing = await db
    .select({ id: franchises.id })
    .from(franchises)
    .where(eq(franchises.wikidataId, wikidataId))
    .limit(1);

  if (existing[0]) {
    return { id: existing[0].id, created: false };
  }

  const result = await createFranchise({ name, wikidataId });
  return { id: result.id, created: true };
}