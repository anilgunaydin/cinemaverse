import { z } from "zod";

import { getCurrentUser, requireUser, UnauthorizedError } from "@/lib/auth/current-user";
import { deleteList, getListDetail, updateList } from "@/lib/community/lists";
import { jsonError, jsonOk, parseJsonBody } from "@/lib/http";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  const { id } = await params;

  const list = await getListDetail(id, user?.id ?? null);
  if (!list) {
    return jsonError("Liste bulunamadı.", 404, { code: "not_found" });
  }
  return jsonOk({ list });
}

const updateListSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  visibility: z.enum(["private", "followers", "public"]).optional(),
});

export async function PATCH(
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

  const { id } = await params;
  const parsed = await parseJsonBody(request, updateListSchema);
  if (!parsed.success) return parsed.response;

  const result = await updateList(user.id, id, parsed.data);
  if (!result.ok) {
    return jsonError(
      result.reason === "not_found"
        ? "Liste bulunamadı."
        : "Bu listeyi düzenleme yetkiniz yok.",
      404,
      { code: result.reason },
    );
  }
  return jsonOk({ ok: true });
}

export async function DELETE(
  _request: Request,
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

  const { id } = await params;
  const deleted = await deleteList(user.id, id);
  if (!deleted) {
    return jsonError("Liste bulunamadı veya yetkiniz yok.", 404, {
      code: "not_found",
    });
  }
  return jsonOk({ ok: true });
}