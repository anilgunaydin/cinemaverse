import { z } from "zod";

import { requireUser, UnauthorizedError } from "@/lib/auth/current-user";
import { moderateContent } from "@/lib/community/reports";
import { jsonError, jsonOk, parseJsonBody } from "@/lib/http";

const moderateSchema = z.object({
  targetType: z.enum(["review", "reply", "thread", "post", "user"]),
  targetId: z.string().trim().min(1),
  action: z.enum(["hide", "remove", "restore"]),
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

  const isModerator = user.role === "admin" || user.role === "moderator";
  if (!isModerator) {
    return jsonError("Bu işlem için moderatör yetkisi gereklidir.", 403, { code: "forbidden" });
  }

  const parsed = await parseJsonBody(request, moderateSchema);
  if (!parsed.success) return parsed.response;

  const result = await moderateContent(
    user.id,
    parsed.data.targetType,
    parsed.data.targetId,
    parsed.data.action,
  );
  if (!result.ok) {
    return jsonError("İçerik bulunamadı veya işlem yapılamadı.", 404, { code: "not_found" });
  }
  return jsonOk({ ok: true });
}