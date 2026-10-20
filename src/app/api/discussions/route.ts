import { z } from "zod";

import {
  getCurrentUser,
  requireUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { getTitleById } from "@/lib/catalog/service";
import { createThread, listThreads } from "@/lib/community/discussions";
import { jsonError, jsonOk, parseJsonBody, rateLimit } from "@/lib/http";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  const url = new URL(request.url);
  const titleId = url.searchParams.get("titleId");

  const items = await listThreads({
    titleId: titleId ?? undefined,
    viewerId: user?.id ?? null,
    limit: 40,
  });
  return jsonOk({ items });
}

const createThreadSchema = z.object({
  titleId: z.string().trim().min(1).nullable().optional(),
  heading: z.string().trim().min(3).max(200),
  body: z.string().trim().min(1).max(20000),
  containsSpoiler: z.boolean().optional(),
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

  const limit = rateLimit(`thread:${user.id}`, 10, 60_000);
  if (!limit.allowed) {
    return jsonError("Çok sık konu açılıyor.", 429, { code: "rate_limited" });
  }

  const parsed = await parseJsonBody(request, createThreadSchema);
  if (!parsed.success) return parsed.response;

  const { titleId } = parsed.data;
  if (titleId) {
    const title = await getTitleById(titleId);
    if (!title) {
      return jsonError("Yapım bulunamadı.", 404, { code: "title_not_found" });
    }
  }

  const result = await createThread(user.id, {
    ...parsed.data,
    titleId: titleId ?? null,
  });
  return jsonOk({ threadId: result.id }, 201);
}
