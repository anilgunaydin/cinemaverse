import { z } from "zod";

import { getCurrentUser, requireUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createList, listPublicLists, listUserLists } from "@/lib/community/lists";
import { jsonError, jsonOk, parseJsonBody, rateLimit } from "@/lib/http";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  const url = new URL(request.url);
  const targetUserId = url.searchParams.get("userId");

  if (targetUserId) {
    const items = await listUserLists(targetUserId, user?.id ?? null);
    return jsonOk({ items });
  }

  const items = await listPublicLists(40);
  return jsonOk({ items });
}

const createListSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(2000).nullable().optional(),
  visibility: z.enum(["private", "followers", "public"]).optional(),
});

export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return jsonError(error.message, 401, { code: "unauthorized" });
    }
    throw error;
  }

  const limit = rateLimit(`list:${user.id}`, 20, 60_000);
  if (!limit.allowed) {
    return jsonError("Çok sık liste oluşturuluyor.", 429, { code: "rate_limited" });
  }

  const parsed = await parseJsonBody(request, createListSchema);
  if (!parsed.success) return parsed.response;

  const result = await createList(user.id, parsed.data);
  return jsonOk({ listId: result.id }, 201);
}