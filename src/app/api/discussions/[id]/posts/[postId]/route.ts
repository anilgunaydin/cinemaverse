import { requireUser, UnauthorizedError } from "@/lib/auth/current-user";
import { deletePost } from "@/lib/community/discussions";
import { jsonError, jsonOk } from "@/lib/http";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; postId: string }> },
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

  const { postId } = await params;
  const deleted = await deletePost(user.id, postId);
  if (!deleted) {
    return jsonError("Yanıt bulunamadı veya yetkiniz yok.", 404, {
      code: "not_found",
    });
  }
  return jsonOk({ ok: true });
}
