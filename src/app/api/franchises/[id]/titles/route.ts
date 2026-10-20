import { z } from "zod";

import { requireUser, UnauthorizedError } from "@/lib/auth/current-user";
import { getTitleById } from "@/lib/catalog/service";
import { addTitleToFranchise } from "@/lib/community/franchises";
import { jsonError, jsonOk, parseJsonBody, rateLimit } from "@/lib/http";

const addTitleSchema = z.object({
  titleId: z.string().trim().min(1),
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

  const isModerator = user.role === "admin" || user.role === "moderator";
  if (!isModerator) {
    return jsonError("Bu işlem için moderatör yetkisi gereklidir.", 403, { code: "forbidden" });
  }

  const limit = rateLimit(`franchise-title:${user.id}`, 30, 60_000);
  if (!limit.allowed) {
    return jsonError("Çok sık başlık ekleniyor.", 429, { code: "rate_limited" });
  }

  const { id } = await params;
  const parsed = await parseJsonBody(request, addTitleSchema);
  if (!parsed.success) return parsed.response;

  const title = await getTitleById(parsed.data.titleId);
  if (!title) {
    return jsonError("Yapım bulunamadı.", 404, { code: "title_not_found" });
  }

  const result = await addTitleToFranchise(id, parsed.data.titleId);
  if (!result.ok) {
    return jsonError(
      result.reason === "not_found"
        ? "Franchise veya yapım bulunamadı."
        : "Bu yapım zaten franchise'de.",
      400,
      { code: result.reason },
    );
  }
  return jsonOk({ ok: true }, 201);
}