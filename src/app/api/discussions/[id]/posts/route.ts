import { z } from "zod";

import { requireUser, UnauthorizedError } from "@/lib/auth/current-user";
import { addPost } from "@/lib/community/discussions";
import { jsonError, jsonOk, parseJsonBody, rateLimit } from "@/lib/http";

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
  return jsonOk({ postId: result.id }, 201);
}
