import { z } from "zod";

import { requireUser, UnauthorizedError } from "@/lib/auth/current-user";
import { sendMessage } from "@/lib/ai/conversation";
import { jsonError, jsonOk, parseJsonBody, rateLimit } from "@/lib/http";

const sendSchema = z.object({
  content: z.string().trim().min(1).max(4000),
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

  const limit = rateLimit(`ai-msg:${user.id}`, 20, 60_000);
  if (!limit.allowed) {
    return jsonError("Çok sık mesaj gönderiliyor. Lütfen bekleyin.", 429, {
      code: "rate_limited",
    });
  }

  const parsed = await parseJsonBody(request, sendSchema);
  if (!parsed.success) return parsed.response;

  const { id } = await params;
  const result = await sendMessage(user.id, id, parsed.data.content);

  if (!result.ok) {
    if (result.reason === "not_found") {
      return jsonError(result.message, 404, { code: "not_found" });
    }
    if (result.reason === "disabled") {
      return jsonError(result.message, 409, { code: "ai_disabled" });
    }
    return jsonError(result.message, 502, { code: "ai_error" });
  }

  return jsonOk({
    userMessage: result.userMessage,
    assistantMessage: result.assistantMessage,
  });
}
