import { z } from "zod";

import { requireUser, UnauthorizedError } from "@/lib/auth/current-user";
import {
  generateRecommendations,
  listRecommendationViews,
} from "@/lib/recommendations/service";
import { jsonError, jsonOk, parseJsonBody, rateLimit } from "@/lib/http";

export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return jsonError(error.message, 401, { code: "unauthorized" });
    }
    throw error;
  }

  const items = await listRecommendationViews(user.id);
  return jsonOk({ items });
}

export async function POST() {
  let user;
  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return jsonError(error.message, 401, { code: "unauthorized" });
    }
    throw error;
  }

  const limit = rateLimit(`rec:${user.id}`, 10, 60_000);
  if (!limit.allowed) {
    return jsonError("Çok sık öneri üretiliyor. Lütfen bekleyin.", 429, {
      code: "rate_limited",
    });
  }

  const outcome = await generateRecommendations(user.id);
  return jsonOk(outcome);
}

const feedbackSchema = z.object({
  titleId: z.string().trim().min(1),
  verdict: z.enum(["liked", "not_interested", "saved", "watched"]),
  note: z.string().max(1000).optional(),
});

export async function PUT(request: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return jsonError(error.message, 401, { code: "unauthorized" });
    }
    throw error;
  }

  const parsed = await parseJsonBody(request, feedbackSchema);
  if (!parsed.success) return parsed.response;

  const { saveRecommendationFeedback } = await import(
    "@/lib/recommendations/service"
  );
  await saveRecommendationFeedback(
    user.id,
    parsed.data.titleId,
    parsed.data.verdict,
    parsed.data.note,
  );

  return jsonOk({ ok: true });
}
