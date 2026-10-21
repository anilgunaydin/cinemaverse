import { requireUser, UnauthorizedError } from "@/lib/auth/current-user";
import { translateExternalComment } from "@/lib/ai/translate";
import { jsonError, jsonOk, rateLimit } from "@/lib/http";

/**
 * POST /api/external-comments/[id]/translate
 * Yabanci bir internet yorumunu yerel AI ile Turkceye cevirir ve saklar.
 */
export async function POST(
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

  const limit = rateLimit(`translate:${user.id}`, 15, 60_000);
  if (!limit.allowed) {
    return jsonError(
      `Çok sık çeviri istendi. ${limit.retryAfterSeconds} saniye sonra deneyin.`,
      429,
      { code: "rate_limited" },
    );
  }

  const { id } = await params;
  const result = await translateExternalComment(id);

  if (!result.ok) {
    if (result.reason === "not_found") {
      return jsonError(result.message, 404, { code: "not_found" });
    }
    if (result.reason === "already_turkish") {
      return jsonError(result.message, 409, { code: "already_turkish" });
    }
    if (result.reason === "disabled") {
      return jsonError(result.message, 409, { code: "ai_disabled" });
    }
    return jsonError(result.message, 502, { code: "ai_error" });
  }

  return jsonOk({
    translation: result.translation,
    model: result.model,
    cached: result.cached,
  });
}
