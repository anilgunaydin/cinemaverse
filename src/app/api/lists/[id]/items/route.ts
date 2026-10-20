import { z } from "zod";

import { requireUser, UnauthorizedError } from "@/lib/auth/current-user";
import { addItemToList } from "@/lib/community/lists";
import { getTitleById } from "@/lib/catalog/service";
import { jsonError, jsonOk, parseJsonBody, rateLimit } from "@/lib/http";

const addItemSchema = z.object({
  titleId: z.string().trim().min(1),
  note: z.string().trim().max(1000).nullable().optional(),
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

  const limit = rateLimit(`list-item:${user.id}`, 60, 60_000);
  if (!limit.allowed) {
    return jsonError("Çok sık öğe ekleniyor.", 429, { code: "rate_limited" });
  }

  const parsed = await parseJsonBody(request, addItemSchema);
  if (!parsed.success) return parsed.response;

  const { id } = await params;
  const title = await getTitleById(parsed.data.titleId);
  if (!title) {
    return jsonError("Yapım bulunamadı.", 404, { code: "title_not_found" });
  }

  const result = await addItemToList(user.id, id, parsed.data);
  if (!result.ok) {
    return jsonError(
      result.reason === "not_found"
        ? "Liste bulunamadı."
        : "Bu listeye ekleme yetkiniz yok.",
      403,
      { code: result.reason },
    );
  }
  return jsonOk({ ok: true }, 201);
}