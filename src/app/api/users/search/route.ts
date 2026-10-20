import { getCurrentUser } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { jsonOk } from "@/lib/http";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return jsonOk({ items: [] });
  }

  const db = getDb();
  const rows = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(
      sql`${users.displayName} ILIKE ${`%${q}%`} OR ${users.email} ILIKE ${`%${q}%`}`,
    )
    .limit(20);

  const items = rows
    .filter((r) => r.id !== user?.id)
    .map((r) => ({
      id: r.id,
      displayName: r.displayName,
    }));

  return jsonOk({ items });
}