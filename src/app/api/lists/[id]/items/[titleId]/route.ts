import { requireUser, UnauthorizedError } from "@/lib/auth/current-user";
import { removeItemFromList } from "@/lib/community/lists";
import { jsonError, jsonOk } from "@/lib/http";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; titleId: string }> },
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

  const { id, titleId } = await params;
  const removed = await removeItemFromList(user.id, id, titleId);
  if (!removed) {
    return jsonError("Öğe bulunamadı veya yetkiniz yok.", 404, {
      code: "not_found",
    });
  }
  return jsonOk({ ok: true });
}