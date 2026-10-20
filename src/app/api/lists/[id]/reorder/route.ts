import { z } from "zod";

import { requireUser, UnauthorizedError } from "@/lib/auth/current-user";
import { reorderListItems } from "@/lib/community/lists";
import { jsonError, jsonOk, parseJsonBody, rateLimit } from "@/lib/http";

const reorderSchema = z.object({
  orderedTitleIds: z.array(z.string().trim().min(1)).max(500),
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

  const limit = rateLimit(`list-reorder:${user.id}`, 10, 60_000);
  if (!limit.allowed) {
    return jsonError("Çok sık sıralama değiştiriliyor.", 429, {
      code: "rate_limited",
    });
  }

  const parsed = await parseJsonBody(request, reorderSchema);
  if (!parsed.success) return parsed.response;

  const { id } = await params;
  const result = await reorderListItems(user.id, id, parsed.data.orderedTitleIds);
  if (!result.ok) {
    return jsonError(
      result.reason === "not_found"
        ? "Liste bulunamadı."
        : "Bu listeyi sıralama yetkiniz yok.",
      403,
      { code: result.reason },
    );
  }
  return jsonOk({ ok: true });
}