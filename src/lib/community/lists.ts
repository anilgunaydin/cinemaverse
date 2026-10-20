import "server-only";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  titles,
  userListItems,
  userLists,
  users,
} from "@/lib/db/schema";
import { newId, nowIso, sanitizePlainText } from "@/lib/http";
import { isContentVisibleTo } from "@/lib/community/access";

export type ListVisibility = "private" | "followers" | "public";

export type ListInput = {
  name: string;
  description?: string | null;
  visibility?: ListVisibility;
};

export type ListItemInput = {
  titleId: string;
  note?: string | null;
};

export type ListView = {
  id: string;
  userId: string;
  userName: string;
  name: string;
  description: string | null;
  visibility: ListVisibility;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
};

export type ListDetail = ListView & {
  items: ListItemView[];
};

export type ListItemView = {
  id: string;
  listId: string;
  titleId: string;
  titleName: string;
  titleReleaseYear: number | null;
  titlePosterUrl: string | null;
  position: number;
  note: string | null;
  createdAt: string;
};

type ListRow = {
  list: typeof userLists.$inferSelect;
  userName: string | null;
};

function toListView(row: ListRow, itemCount: number): ListView {
  return {
    id: row.list.id,
    userId: row.list.userId,
    userName: row.userName ?? "Kullanıcı",
    name: row.list.name,
    description: row.list.description,
    visibility: row.list.visibility,
    createdAt: row.list.createdAt,
    updatedAt: row.list.createdAt,
    itemCount,
  };
}

function toItemView(row: {
  item: typeof userListItems.$inferSelect;
  title: typeof titles.$inferSelect | null;
}): ListItemView {
  return {
    id: `${row.item.listId}-${row.item.titleId}`,
    listId: row.item.listId,
    titleId: row.item.titleId,
    titleName: row.title
      ? row.title.localizedTitle ?? row.title.originalTitle
      : "Bilinmeyen yapım",
    titleReleaseYear: row.title?.releaseYear ?? null,
    titlePosterUrl: row.title?.posterUrl ?? null,
    position: row.item.position,
    note: row.item.note,
    createdAt: row.item.createdAt,
  };
}

/** Yeni bir liste oluşturur. */
export async function createList(
  userId: string,
  input: ListInput,
): Promise<{ id: string }> {
  const db = getDb();
  const now = nowIso();
  const name = sanitizePlainText(input.name).slice(0, 100);
  const description = input.description
    ? sanitizePlainText(input.description).slice(0, 2000)
    : null;
  const id = newId("lst");

  await db.insert(userLists).values({
    id,
    userId,
    name,
    description,
    visibility: input.visibility ?? "private",
    createdAt: now,
  });

  return { id };
}

/** Liste detayını (öğelerle birlikte) getirir — erişim kontrolü ile. */
export async function getListDetail(
  listId: string,
  viewerId?: string | null,
): Promise<ListDetail | null> {
  const db = getDb();

  const rows = await db
    .select({ list: userLists, userName: users.displayName })
    .from(userLists)
    .innerJoin(users, eq(users.id, userLists.userId))
    .where(eq(userLists.id, listId))
    .limit(1);

  const row = rows[0];
  if (!row || !isContentVisibleTo(row.list, viewerId)) return null;

  const itemRows = await db
    .select({
      item: userListItems,
      title: titles,
    })
    .from(userListItems)
    .leftJoin(titles, eq(titles.id, userListItems.titleId))
    .where(eq(userListItems.listId, listId))
    .orderBy(asc(userListItems.position), asc(userListItems.createdAt))
    .limit(500);

  const items = itemRows.map(toItemView);
  return { ...toListView(row, items.length), items };
}

/** Kullanıcının listelerini getirir (kendi özel listelerini de görür). */
export async function listUserLists(
  userId: string,
  viewerId?: string | null,
): Promise<ListView[]> {
  const db = getDb();

  const rows = await db
    .select({ list: userLists, userName: users.displayName })
    .from(userLists)
    .innerJoin(users, eq(users.id, userLists.userId))
    .where(eq(userLists.userId, userId))
    .orderBy(desc(userLists.createdAt))
    .limit(100);

  const visibleRows = rows.filter((row) =>
    isContentVisibleTo(row.list, viewerId),
  );
  const ids = visibleRows.map((row) => row.list.id);

  const countMap = new Map<string, number>();
  if (ids.length > 0) {
    const counts = await db
      .select({
        listId: userListItems.listId,
        count: sql<number>`count(*)`,
      })
      .from(userListItems)
      .where(inArray(userListItems.listId, ids))
      .groupBy(userListItems.listId);
    for (const item of counts) {
      countMap.set(item.listId, Number(item.count));
    }
  }

  return visibleRows.map((row) =>
    toListView(row, countMap.get(row.list.id) ?? 0),
  );
}

/** Herkese açık listeleri getirir (topluluk sayfası için). */
export async function listPublicLists(limit = 30): Promise<ListView[]> {
  const db = getDb();

  const rows = await db
    .select({ list: userLists, userName: users.displayName })
    .from(userLists)
    .innerJoin(users, eq(users.id, userLists.userId))
    .where(
      and(
        eq(userLists.visibility, "public"),
        eq(userLists.moderationStatus, "visible"),
      ),
    )
    .orderBy(desc(userLists.createdAt))
    .limit(Math.min(Math.max(limit, 1), 100));

  const ids = rows.map((row) => row.list.id);
  const countMap = new Map<string, number>();
  if (ids.length > 0) {
    const counts = await db
      .select({
        listId: userListItems.listId,
        count: sql<number>`count(*)`,
      })
      .from(userListItems)
      .where(inArray(userListItems.listId, ids))
      .groupBy(userListItems.listId);
    for (const item of counts) {
      countMap.set(item.listId, Number(item.count));
    }
  }

  return rows.map((row) => toListView(row, countMap.get(row.list.id) ?? 0));
}

/** Listeye öğe ekler/günceller. */
export async function addItemToList(
  userId: string,
  listId: string,
  input: ListItemInput,
): Promise<{ ok: true } | { ok: false; reason: "not_found" | "forbidden" }> {
  const db = getDb();

  const rows = await db
    .select({ list: userLists })
    .from(userLists)
    .where(eq(userLists.id, listId))
    .limit(1);

  const list = rows[0]?.list;
  if (!list) return { ok: false, reason: "not_found" };
  if (list.userId !== userId) return { ok: false, reason: "forbidden" };

  const note = input.note
    ? sanitizePlainText(input.note).slice(0, 1000)
    : null;

  // Mevcut pozisyonda en sona ekle (max position + 1)
  const maxPosRow = await db
    .select({ maxPos: sql<number>`max(${userListItems.position})` })
    .from(userListItems)
    .where(eq(userListItems.listId, listId))
    .limit(1);
  const nextPosition = (maxPosRow[0]?.maxPos ?? -1) + 1;

  await db
    .insert(userListItems)
    .values({
      listId,
      titleId: input.titleId,
      position: nextPosition,
      note,
    })
    .onConflictDoUpdate({
      target: [userListItems.listId, userListItems.titleId],
      set: { position: nextPosition, note },
    });

  return { ok: true };
}

/** Listeden öğe kaldırır. */
export async function removeItemFromList(
  userId: string,
  listId: string,
  titleId: string,
): Promise<boolean> {
  const db = getDb();

  const rows = await db
    .select({ list: userLists })
    .from(userLists)
    .where(eq(userLists.id, listId))
    .limit(1);

  const list = rows[0]?.list;
  if (!list || list.userId !== userId) return false;

  const result = await db
    .delete(userListItems)
    .where(
      and(
        eq(userListItems.listId, listId),
        eq(userListItems.titleId, titleId),
      ),
    );
  return result.changes > 0;
}

/** Liste öğelerini yeniden sıralar (position günceller). */
export async function reorderListItems(
  userId: string,
  listId: string,
  orderedTitleIds: string[],
): Promise<{ ok: true } | { ok: false; reason: "not_found" | "forbidden" }> {
  const db = getDb();

  const rows = await db
    .select({ list: userLists })
    .from(userLists)
    .where(eq(userLists.id, listId))
    .limit(1);

  const list = rows[0]?.list;
  if (!list) return { ok: false, reason: "not_found" };
  if (list.userId !== userId) return { ok: false, reason: "forbidden" }

  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedTitleIds.length; i++) {
      await tx
        .update(userListItems)
        .set({ position: i })
        .where(
          and(
            eq(userListItems.listId, listId),
            eq(userListItems.titleId, orderedTitleIds[i]),
          ),
        );
    }
  });

  return { ok: true };
}

/** Listeyi günceller (ad, açıklama, görünürlük). */
export async function updateList(
  userId: string,
  listId: string,
  input: Partial<ListInput>,
): Promise<{ ok: true } | { ok: false; reason: "not_found" | "forbidden" }> {
  const db = getDb();

  const rows = await db
    .select({ list: userLists })
    .from(userLists)
    .where(eq(userLists.id, listId))
    .limit(1);

  const list = rows[0]?.list;
  if (!list) return { ok: false, reason: "not_found" };
  if (list.userId !== userId) return { ok: false, reason: "forbidden" }

  const updates: Record<string, unknown> = {};
  if (input.name !== undefined)
    updates.name = sanitizePlainText(input.name).slice(0, 100);
  if (input.description !== undefined)
    updates.description = input.description
      ? sanitizePlainText(input.description).slice(0, 2000)
      : null;
  if (input.visibility !== undefined)
    updates.visibility = input.visibility;

  if (Object.keys(updates).length > 0) {
    await db.update(userLists).set(updates).where(eq(userLists.id, listId));
  }
  return { ok: true };
}

/** Listeyi siler (öğeleri de cascade ile gider — PK composite olduğu için önce öğeler). */
export async function deleteList(
  userId: string,
  listId: string,
): Promise<boolean> {
  const db = getDb();

  const rows = await db
    .select({ list: userLists })
    .from(userLists)
    .where(eq(userLists.id, listId))
    .limit(1);

  const list = rows[0]?.list;
  if (!list || list.userId !== userId) return false;

  await db
    .delete(userListItems)
    .where(eq(userListItems.listId, listId));
  const result = await db
    .delete(userLists)
    .where(eq(userLists.id, listId));
  return result.changes > 0;
}

/** Belirli bir başlığın kullanıcının hangi listelerinde olduğunu döndürür. */
export async function getListsContainingTitle(
  userId: string,
  titleId: string,
): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ listId: userListItems.listId })
    .from(userListItems)
    .innerJoin(userLists, eq(userLists.id, userListItems.listId))
    .where(
      and(eq(userListItems.titleId, titleId), eq(userLists.userId, userId)),
    );
  return rows.map((row) => row.listId);
}