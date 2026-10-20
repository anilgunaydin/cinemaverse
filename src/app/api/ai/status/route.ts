import { requireUser, UnauthorizedError } from "@/lib/auth/current-user";
import { jsonError, jsonOk } from "@/lib/http";
import { getAiStatus } from "@/lib/ai/provider";

/** AI saglayicisinin durumunu (acik/kapali, saglayici, model) dondurur. */
export async function GET() {
  try {
    await requireUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return jsonError(error.message, 401, { code: "unauthorized" });
    }
    throw error;
  }

  const status = getAiStatus();
  return jsonOk({
    enabled: status.enabled,
    provider: status.provider,
    model: status.model,
    reason: status.reason,
  });
}
