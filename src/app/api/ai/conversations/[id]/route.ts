import { requireUser, UnauthorizedError } from "@/lib/auth/current-user";
import { deleteConversation, getConversationMessages } from "@/lib/ai/conversation";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET(
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
  const result = await getConversationMessages(user.id, id);
  if (!result) {
    return jsonError("Tartışma bulunamadı.", 404, { code: "not_found" });
  }
  return jsonOk(result);
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
  const deleted = await deleteConversation(user.id, id);
  if (!deleted) {
    return jsonError("Konuşma bulunamadı.", 404, { code: "not_found" });
  }
  return jsonOk({ deleted: true });
}
