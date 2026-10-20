import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  blocks,
  follows,
  mutes,
  users,
} from "@/lib/db/schema";
import { nowIso } from "@/lib/http";

/** Kullanıcıyı takip et. */
export async function followUser(
  followerId: string,
  followingId: string,
): Promise<{ ok: true } | { ok: false; reason: "self" | "already" }> {
  if (followerId === followingId) return { ok: false, reason: "self" };

  const db = getDb();
  const existing = await db
    .select()
    .from(follows)
    .where(
      and(
        eq(follows.followerId, followerId),
        eq(follows.followingId, followingId),
      ),
    )
    .limit(1);

  if (existing[0]) return { ok: false, reason: "already" };

  await db.insert(follows).values({
    followerId,
    followingId,
    createdAt: nowIso(),
  });

  return { ok: true };
}

/** Takibi bırak. */
export async function unfollowUser(
  followerId: string,
  followingId: string,
): Promise<boolean> {
  const db = getDb();
  const result = await db
    .delete(follows)
    .where(
      and(
        eq(follows.followerId, followerId),
        eq(follows.followingId, followingId),
      ),
    );
  return result.changes > 0;
}

/** Kullanıcıyı engelle. */
export async function blockUser(
  userId: string,
  blockedUserId: string,
): Promise<{ ok: true } | { ok: false; reason: "self" | "already" }> {
  if (userId === blockedUserId) return { ok: false, reason: "self" };

  const db = getDb();
  const existing = await db
    .select()
    .from(blocks)
    .where(
      and(
        eq(blocks.userId, userId),
        eq(blocks.blockedUserId, blockedUserId),
      ),
    )
    .limit(1);

  if (existing[0]) return { ok: false, reason: "already" };

  await db.insert(blocks).values({
    userId,
    blockedUserId,
    createdAt: nowIso(),
  });

  // Engelleme takibi de kaldırır (her iki yönde)
  await db
    .delete(follows)
    .where(
      and(
        eq(follows.followerId, userId),
        eq(follows.followingId, blockedUserId),
      ),
    );
  await db
    .delete(follows)
    .where(
      and(
        eq(follows.followerId, blockedUserId),
        eq(follows.followingId, userId),
      ),
    );

  return { ok: true };
}

/** Engeli kaldır. */
export async function unblockUser(
  userId: string,
  blockedUserId: string,
): Promise<boolean> {
  const db = getDb();
  const result = await db
    .delete(blocks)
    .where(
      and(
        eq(blocks.userId, userId),
        eq(blocks.blockedUserId, blockedUserId),
      ),
    );
  return result.changes > 0;
}

/** Kullanıcıyı sessize al. */
export async function muteUser(
  userId: string,
  mutedUserId: string,
): Promise<{ ok: true } | { ok: false; reason: "self" | "already" }> {
  if (userId === mutedUserId) return { ok: false, reason: "self" };

  const db = getDb();
  const existing = await db
    .select()
    .from(mutes)
    .where(
      and(
        eq(mutes.userId, userId),
        eq(mutes.mutedUserId, mutedUserId),
      ),
    )
    .limit(1);

  if (existing[0]) return { ok: false, reason: "already" };

  await db.insert(mutes).values({
    userId,
    mutedUserId,
    createdAt: nowIso(),
  });

  return { ok: true };
}

/** Sessize almayı kaldır. */
export async function unmuteUser(
  userId: string,
  mutedUserId: string,
): Promise<boolean> {
  const db = getDb();
  const result = await db
    .delete(mutes)
    .where(
      and(
        eq(mutes.userId, userId),
        eq(mutes.mutedUserId, mutedUserId),
      ),
    );
  return result.changes > 0;
}

/** Kullanıcının takipçilerini getir. */
export async function getFollowers(
  userId: string,
  limit = 50,
): Promise<
  Array<{ id: string; userId: string; displayName: string | null; followedAt: string }>
> {
  const db = getDb();
  const rows = await db
    .select({
      id: follows.followerId,
      userId: follows.followerId,
      displayName: users.displayName,
      followedAt: follows.createdAt,
    })
    .from(follows)
    .innerJoin(users, eq(users.id, follows.followerId))
    .where(eq(follows.followingId, userId))
    .orderBy(desc(follows.createdAt))
    .limit(Math.min(Math.max(limit, 1), 200));
  return rows;
}

/** Kullanıcının takip ettiklerini getir. */
export async function getFollowing(
  userId: string,
  limit = 50,
): Promise<
  Array<{ id: string; userId: string; displayName: string | null; followedAt: string }>
> {
  const db = getDb();
  const rows = await db
    .select({
      id: follows.followingId,
      userId: follows.followingId,
      displayName: users.displayName,
      followedAt: follows.createdAt,
    })
    .from(follows)
    .innerJoin(users, eq(users.id, follows.followingId))
    .where(eq(follows.followerId, userId))
    .orderBy(desc(follows.createdAt))
    .limit(Math.min(Math.max(limit, 1), 200));
  return rows;
}

/** Kullanıcının engellediklerini getir. */
export async function getBlocked(
  userId: string,
  limit = 50,
): Promise<
  Array<{ id: string; userId: string; displayName: string | null; blockedAt: string }>
> {
  const db = getDb();
  const rows = await db
    .select({
      id: blocks.blockedUserId,
      userId: blocks.blockedUserId,
      displayName: users.displayName,
      blockedAt: blocks.createdAt,
    })
    .from(blocks)
    .innerJoin(users, eq(users.id, blocks.blockedUserId))
    .where(eq(blocks.userId, userId))
    .orderBy(desc(blocks.createdAt))
    .limit(Math.min(Math.max(limit, 1), 200));
  return rows;
}

/** Kullanıcının sessize aldıklarını getir. */
export async function getMuted(
  userId: string,
  limit = 50,
): Promise<
  Array<{ id: string; userId: string; displayName: string | null; mutedAt: string }>
> {
  const db = getDb();
  const rows = await db
    .select({
      id: mutes.mutedUserId,
      userId: mutes.mutedUserId,
      displayName: users.displayName,
      mutedAt: mutes.createdAt,
    })
    .from(mutes)
    .innerJoin(users, eq(users.id, mutes.mutedUserId))
    .where(eq(mutes.userId, userId))
    .orderBy(desc(mutes.createdAt))
    .limit(Math.min(Math.max(limit, 1), 200));
  return rows;
}

/** İki kullanıcı arasındaki ilişkiyi kontrol et. */
export async function getRelationship(
  viewerId: string,
  targetId: string,
): Promise<{
  isFollowing: boolean;
  isFollowedBy: boolean;
  isBlocked: boolean;
  isBlocking: boolean;
  isMuted: boolean;
}> {
  const db = getDb();
  const [following, followedBy, blocked, blocking, muted] = await Promise.all([
    db
      .select()
      .from(follows)
      .where(
        and(
          eq(follows.followerId, viewerId),
          eq(follows.followingId, targetId),
        ),
      )
      .limit(1),
    db
      .select()
      .from(follows)
      .where(
        and(
          eq(follows.followerId, targetId),
          eq(follows.followingId, viewerId),
        ),
      )
      .limit(1),
    db
      .select()
      .from(blocks)
      .where(
        and(
          eq(blocks.userId, viewerId),
          eq(blocks.blockedUserId, targetId),
        ),
      )
      .limit(1),
    db
      .select()
      .from(blocks)
      .where(
        and(
          eq(blocks.userId, targetId),
          eq(blocks.blockedUserId, viewerId),
        ),
      )
      .limit(1),
    db
      .select()
      .from(mutes)
      .where(
        and(
          eq(mutes.userId, viewerId),
          eq(mutes.mutedUserId, targetId),
        ),
      )
      .limit(1),
  ]);

  return {
    isFollowing: following.length > 0,
    isFollowedBy: followedBy.length > 0,
    isBlocked: blocked.length > 0,
    isBlocking: blocking.length > 0,
    isMuted: muted.length > 0,
  };
}

/** Kullanıcı takipçi/etakip sayılarını getir. */
export async function getFollowCounts(userId: string): Promise<{
  followersCount: number;
  followingCount: number;
}> {
  const db = getDb();
  const [followers, following] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(follows)
      .where(eq(follows.followingId, userId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(follows)
      .where(eq(follows.followerId, userId)),
  ]);
  return {
    followersCount: Number(followers[0]?.count ?? 0),
    followingCount: Number(following[0]?.count ?? 0),
  };
}

/** Bir kullanıcı listesinin takipçi/etakip/bloque/muted durumunu toplu kontrol et. */
export async function getRelationshipsBatch(
  viewerId: string,
  targetIds: string[],
): Promise<
  Map<
    string,
    {
      isFollowing: boolean;
      isFollowedBy: boolean;
      isBlocked: boolean;
      isBlocking: boolean;
      isMuted: boolean;
    }
  >
> {
  if (targetIds.length === 0) return new Map();

  const db = getDb();
  const [followingRows, followedByRows, blockedRows, blockingRows, mutedRows] =
    await Promise.all([
      db
        .select({ followingId: follows.followingId })
        .from(follows)
        .where(
          and(
            eq(follows.followerId, viewerId),
            inArray(follows.followingId, targetIds),
          ),
        ),
      db
        .select({ followerId: follows.followerId })
        .from(follows)
        .where(
          and(
            eq(follows.followingId, viewerId),
            inArray(follows.followerId, targetIds),
          ),
        ),
      db
        .select({ blockedUserId: blocks.blockedUserId })
        .from(blocks)
        .where(
          and(
            eq(blocks.userId, viewerId),
            inArray(blocks.blockedUserId, targetIds),
          ),
        ),
      db
        .select({ userId: blocks.userId })
        .from(blocks)
        .where(
          and(
            eq(blocks.blockedUserId, viewerId),
            inArray(blocks.userId, targetIds),
          ),
        ),
      db
        .select({ mutedUserId: mutes.mutedUserId })
        .from(mutes)
        .where(
          and(
            eq(mutes.userId, viewerId),
            inArray(mutes.mutedUserId, targetIds),
          ),
        ),
    ]);

  const followingSet = new Set(followingRows.map((r) => r.followingId));
  const followedBySet = new Set(followedByRows.map((r) => r.followerId));
  const blockedSet = new Set(blockedRows.map((r) => r.blockedUserId));
  const blockingSet = new Set(blockingRows.map((r) => r.userId));
  const mutedSet = new Set(mutedRows.map((r) => r.mutedUserId));

  const result = new Map();
  for (const targetId of targetIds) {
    result.set(targetId, {
      isFollowing: followingSet.has(targetId),
      isFollowedBy: followedBySet.has(targetId),
      isBlocked: blockedSet.has(targetId),
      isBlocking: blockingSet.has(targetId),
      isMuted: mutedSet.has(targetId),
    });
  }
  return result;
}