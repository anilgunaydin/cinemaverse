import "server-only";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  discussionPosts,
  discussionThreads,
  titles,
  users,
} from "@/lib/db/schema";
import { newId, nowIso, sanitizePlainText } from "@/lib/http";
import { isContentVisibleTo } from "@/lib/community/access";

export type ThreadVisibility = "private" | "followers" | "public";

export type ThreadInput = {
  titleId?: string | null;
  heading: string;
  body: string;
  containsSpoiler?: boolean;
  visibility?: ThreadVisibility;
};

export type PostInput = {
  body: string;
  containsSpoiler?: boolean;
};

export type ThreadPostView = {
  id: string;
  threadId: string;
  authorId: string;
  authorName: string;
  body: string;
  containsSpoiler: boolean;
  createdAt: string;
};

export type ThreadSummary = {
  id: string;
  titleId: string | null;
  titleName: string | null;
  titleReleaseYear: number | null;
  authorId: string;
  authorName: string;
  heading: string;
  body: string;
  containsSpoiler: boolean;
  visibility: ThreadVisibility;
  createdAt: string;
  updatedAt: string;
  postCount: number;
  lastActivityAt: string;
};

export type ThreadDetail = ThreadSummary & { posts: ThreadPostView[] };

type ThreadRow = {
  thread: typeof discussionThreads.$inferSelect;
  authorName: string | null;
  title: typeof titles.$inferSelect | null;
};

/**
 * Erisim kurali, `@/lib/community/access` icindeki saf fonksiyona devredilir.
 * Ayrintili kural dokumantasyonu orada bulunur.
 */
function isThreadVisibleTo(
  thread: {
    userId: string;
    visibility: ThreadVisibility;
    moderationStatus: string;
  },
  viewerId: string | null | undefined,
): boolean {
  return isContentVisibleTo(
    {
      userId: thread.userId,
      visibility: thread.visibility,
      moderationStatus: thread.moderationStatus as
        | "visible"
        | "hidden"
        | "removed",
    },
    viewerId,
  );
}

function toPostView(row: {
  post: typeof discussionPosts.$inferSelect;
  authorName: string | null;
}): ThreadPostView {
  return {
    id: row.post.id,
    threadId: row.post.threadId,
    authorId: row.post.userId,
    authorName: row.authorName ?? "Kullanıcı",
    body: row.post.body,
    containsSpoiler: row.post.containsSpoiler,
    createdAt: row.post.createdAt,
  };
}

function toSummary(
  row: ThreadRow,
  postCount: number,
  lastActivityAt: string,
): ThreadSummary {
  return {
    id: row.thread.id,
    titleId: row.thread.titleId,
    titleName: row.title
      ? row.title.localizedTitle ?? row.title.originalTitle
      : null,
    titleReleaseYear: row.title?.releaseYear ?? null,
    authorId: row.thread.userId,
    authorName: row.authorName ?? "Kullanıcı",
    heading: row.thread.heading,
    body: row.thread.body,
    containsSpoiler: row.thread.containsSpoiler,
    visibility: row.thread.visibility,
    createdAt: row.thread.createdAt,
    updatedAt: row.thread.updatedAt,
    postCount,
    lastActivityAt,
  };
}

/** Yeni bir tartisma konusu olusturur. */
export async function createThread(
  userId: string,
  input: ThreadInput,
): Promise<{ id: string }> {
  const db = getDb();
  const now = nowIso();
  const heading = sanitizePlainText(input.heading).slice(0, 200);
  const body = sanitizePlainText(input.body).slice(0, 20000);
  const id = newId("thr");

  await db.insert(discussionThreads).values({
    id,
    userId,
    titleId: input.titleId ?? null,
    heading,
    body,
    containsSpoiler: input.containsSpoiler ?? false,
    visibility: input.visibility ?? "public",
    createdAt: now,
    updatedAt: now,
  });

  return { id };
}

/** Tartisma listesi. `titleId` verilirse yalnizca o yapimin konulari. */
export async function listThreads(
  options: {
    titleId?: string | null;
    viewerId?: string | null;
    limit?: number;
  } = {},
): Promise<ThreadSummary[]> {
  const db = getDb();
  const limit = Math.min(Math.max(options.limit ?? 40, 1), 100);

  const rows = await db
    .select({
      thread: discussionThreads,
      authorName: users.displayName,
      title: titles,
    })
    .from(discussionThreads)
    .innerJoin(users, eq(users.id, discussionThreads.userId))
    .leftJoin(titles, eq(titles.id, discussionThreads.titleId))
    .where(
      and(
        eq(discussionThreads.moderationStatus, "visible"),
        options.titleId
          ? eq(discussionThreads.titleId, options.titleId)
          : undefined,
      ),
    )
    .orderBy(desc(discussionThreads.updatedAt))
    .limit(200);

  const visibleRows = rows.filter((row) =>
    isThreadVisibleTo(row.thread, options.viewerId),
  );
  const ids = visibleRows.map((row) => row.thread.id);

  const countMap = new Map<
    string,
    { count: number; last: string | null }
  >();
  if (ids.length > 0) {
    const counts = await db
      .select({
        threadId: discussionPosts.threadId,
        count: sql<number>`count(*)`,
        last: sql<string | null>`max(${discussionPosts.createdAt})`,
      })
      .from(discussionPosts)
      .where(
        and(
          inArray(discussionPosts.threadId, ids),
          eq(discussionPosts.moderationStatus, "visible"),
        ),
      )
      .groupBy(discussionPosts.threadId);
    for (const item of counts) {
      countMap.set(item.threadId, {
        count: Number(item.count),
        last: item.last,
      });
    }
  }

  return visibleRows
    .map((row) => {
      const aggregate = countMap.get(row.thread.id);
      const lastActivityAt =
        aggregate?.last && aggregate.last > row.thread.updatedAt
          ? aggregate.last
          : row.thread.updatedAt;
      return toSummary(row, aggregate?.count ?? 0, lastActivityAt);
    })
    .sort((a, b) => (a.lastActivityAt < b.lastActivityAt ? 1 : -1))
    .slice(0, limit);
}

/** Tek bir konuyu, gonderileriyle birlikte dondurur (erisim kontrolu ile). */
export async function getThreadDetail(
  threadId: string,
  viewerId?: string | null,
): Promise<ThreadDetail | null> {
  const db = getDb();

  const rows = await db
    .select({
      thread: discussionThreads,
      authorName: users.displayName,
      title: titles,
    })
    .from(discussionThreads)
    .innerJoin(users, eq(users.id, discussionThreads.userId))
    .leftJoin(titles, eq(titles.id, discussionThreads.titleId))
    .where(eq(discussionThreads.id, threadId))
    .limit(1);

  const row = rows[0];
  if (!row || !isThreadVisibleTo(row.thread, viewerId)) return null;

  const postRows = await db
    .select({ post: discussionPosts, authorName: users.displayName })
    .from(discussionPosts)
    .innerJoin(users, eq(users.id, discussionPosts.userId))
    .where(
      and(
        eq(discussionPosts.threadId, threadId),
        eq(discussionPosts.moderationStatus, "visible"),
      ),
    )
    .orderBy(asc(discussionPosts.createdAt))
    .limit(500);

  const posts = postRows.map(toPostView);
  const lastActivityAt =
    posts.length > 0
      ? posts[posts.length - 1].createdAt
      : row.thread.updatedAt;

  return { ...toSummary(row, posts.length, lastActivityAt), posts };
}

/** Konuya yanit ekler. Konu yoksa veya erisilemezse hata dondurur. */
export async function addPost(
  userId: string,
  threadId: string,
  input: PostInput,
): Promise<{ ok: true; id: string } | { ok: false; reason: "not_found" }> {
  const db = getDb();

  const rows = await db
    .select({ thread: discussionThreads })
    .from(discussionThreads)
    .where(eq(discussionThreads.id, threadId))
    .limit(1);

  const thread = rows[0]?.thread;
  if (!thread || !isThreadVisibleTo(thread, userId)) {
    return { ok: false, reason: "not_found" };
  }

  const now = nowIso();
  const body = sanitizePlainText(input.body).slice(0, 20000);
  const id = newId("post");

  await db.insert(discussionPosts).values({
    id,
    threadId,
    userId,
    body,
    containsSpoiler: input.containsSpoiler ?? false,
    createdAt: now,
  });
  await db
    .update(discussionThreads)
    .set({ updatedAt: now })
    .where(eq(discussionThreads.id, threadId));

  return { ok: true, id };
}

/** Yalnizca yazar kendi konusunu (ve yanitlarini) silebilir. */
export async function deleteThread(
  userId: string,
  threadId: string,
): Promise<boolean> {
  const db = getDb();

  const rows = await db
    .select({ userId: discussionThreads.userId })
    .from(discussionThreads)
    .where(eq(discussionThreads.id, threadId))
    .limit(1);

  if (!rows[0] || rows[0].userId !== userId) return false;

  await db
    .delete(discussionPosts)
    .where(eq(discussionPosts.threadId, threadId));
  const result = await db
    .delete(discussionThreads)
    .where(eq(discussionThreads.id, threadId));
  return result.changes > 0;
}

/** Yalnizca yazar kendi yanitini silebilir. */
export async function deletePost(
  userId: string,
  postId: string,
): Promise<boolean> {
  const db = getDb();
  const result = await db
    .delete(discussionPosts)
    .where(
      and(eq(discussionPosts.id, postId), eq(discussionPosts.userId, userId)),
    );
  return result.changes > 0;
}
