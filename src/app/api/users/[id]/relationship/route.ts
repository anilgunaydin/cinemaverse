import { requireUser, UnauthorizedError } from "@/lib/auth/current-user";
import { getRelationship } from "@/lib/community/social";
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
  const relationship = await getRelationship(user.id, id);
  return jsonOk({ relationship });
}