import { requireUser, UnauthorizedError } from "@/lib/auth/current-user";
import { removeTitleFromFranchise } from "@/lib/community/franchises";
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

  const isModerator = user.role === "admin" || user.role === "moderator";
  if (!isModerator) {
    return jsonError("Bu işlem için moderatör yetkisi gereklidir.", 403, { code: "forbidden" });
  }

  const { id, titleId } = await params;
  const removed = await removeTitleFromFranchise(id, titleId);
  if (!removed) {
    return jsonError("Bağlantı bulunamadı.", 404, { code: "not_found" });
  }
  return jsonOk({ ok: true });
}