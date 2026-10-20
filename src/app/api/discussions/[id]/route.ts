import {
  getCurrentUser,
  requireUser,
  UnauthorizedError,
} from "@/lib/auth/current-user";
import { deleteThread, getThreadDetail } from "@/lib/community/discussions";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  const { id } = await params;

  const thread = await getThreadDetail(id, user?.id ?? null);
  if (!thread) {
    return jsonError("Tartışma bulunamadı.", 404, { code: "not_found" });
  }
  return jsonOk({ thread });
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
  const deleted = await deleteThread(user.id, id);
  if (!deleted) {
    return jsonError("Tartışma bulunamadı veya yetkiniz yok.", 404, {
      code: "not_found",
    });
  }
  return jsonOk({ ok: true });
}
