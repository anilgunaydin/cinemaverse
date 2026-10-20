import { z } from "zod";

import { requireUser, UnauthorizedError } from "@/lib/auth/current-user";
import { addPost } from "@/lib/community/discussions";
import { jsonError, jsonOk, parseJsonBody, rateLimit } from "@/lib/http";
import { createNotification } from "@/lib/notifications/service";
import { getDb } from "@/lib/db";
import { discussionThreads, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const addPostSchema = z.object({
  body: z.string().trim().min(1).max(20000),
  containsSpoiler: z.boolean().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let user;
  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return jsonError(error.message, 401, { code: "unauthorized" });
    }
    throw error;
  }

  const limit = rateLimit(`post:${user.id}`, 30, 60_000);
  if (!limit.allowed) {
    return jsonError("Çok sık yanıt gönderiliyor.", 429, {
      code: "rate_limited",
    });
  }

  const parsed = await parseJsonBody(request, addPostSchema);
  if (!parsed.success) return parsed.response;

  const { id } = await params;
  const result = await addPost(user.id, id, parsed.data);
  if (!result.ok) {
    return jsonError("Tartışma bulunamadı.", 404, { code: "not_found" });
  }

  // Bildirim: konu sahibine "X konuya yanit yazdi"
  try {
    const db = getDb();
    const threadRows = await db
      .select({
        userId: discussionThreads.userId,
        heading: discussionThreads.heading,
      })
      .from(discussionThreads)
      .where(eq(discussionThreads.id, id))
      .limit(1);

    const thread = threadRows[0];
    if (thread && thread.userId !== user.id) {
      const actorRows = await db
        .select({ displayName: users.displayName })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);
      const actorName = actorRows[0]?.displayName ?? "Bir kullanıcı";
      await createNotification({
        userId: thread.userId,
        type: "review_reply",
        message: `${actorName} "${thread.heading}" konusuna yanıt yazdı.`,
        actorId: user.id,
        targetId: result.id,
        targetType: "post",
        deepLink: `/discussions/${id}`,
      });
    }
  } catch (e) {
    console.error("Post notification failed:", e);
  }

  return jsonOk({ postId: result.id }, 201);
}
