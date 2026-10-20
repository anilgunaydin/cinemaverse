import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20"), 50);
    const offset = parseInt(url.searchParams.get("offset") ?? "0");
    const unreadOnly = url.searchParams.get("unread") === "true";

    const db = getDb();

    const where = [eq(notifications.userId, user.id)];
    if (unreadOnly) where.push(eq(notifications.isRead, false));

    const results = await db
      .select()
      .from(notifications)
      .where(and(...where))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    const unreadCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false)));

    return NextResponse.json({
      notifications: results,
      unreadCount: unreadCount[0]?.count ?? 0,
      hasMore: results.length === limit,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}