import { z } from "zod";

import { getCurrentUser, requireUser, UnauthorizedError } from "@/lib/auth/current-user";
import {
  deleteReview,
  listPublicReviews,
  listReviewsForTitle,
  upsertReview,
} from "@/lib/community/reviews";
import { getTitleById } from "@/lib/catalog/service";
import { jsonError, jsonOk, parseJsonBody, rateLimit } from "@/lib/http";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  const url = new URL(request.url);
  const titleId = url.searchParams.get("titleId");

  if (titleId) {
    const items = await listReviewsForTitle(titleId, user?.id);
    return jsonOk({ items });
  }

  const items = await listPublicReviews(40);
  return jsonOk({ items });
}

const reviewSchema = z.object({
  titleId: z.string().trim().min(1),
  body: z.string().trim().min(1).max(10000),
  rating: z.number().min(1).max(10).nullable().optional(),
  containsSpoiler: z.boolean().optional(),
  spoilerScopeSeason: z.number().int().min(0).max(100).nullable().optional(),
  visibility: z.enum(["private", "followers", "public"]).optional(),
});

export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return jsonError(error.message, 401, { code: "unauthorized" });
    }
    throw error;
  }

  const limit = rateLimit(`review:${user.id}`, 20, 60_000);
  if (!limit.allowed) {
    return jsonError("Çok sık inceleme kaydediliyor.", 429, {
      code: "rate_limited",
    });
  }

  const parsed = await parseJsonBody(request, reviewSchema);
  if (!parsed.success) return parsed.response;

  const title = await getTitleById(parsed.data.titleId);
  if (!title) {
    return jsonError("Yapım bulunamadı.", 404, { code: "title_not_found" });
  }

  const result = await upsertReview(user.id, parsed.data);
  return jsonOk({ reviewId: result.id, created: result.created }, result.created ? 201 : 200);
}

export async function DELETE(request: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return jsonError(error.message, 401, { code: "unauthorized" });
    }
    throw error;
  }

  const url = new URL(request.url);
  const reviewId = url.searchParams.get("reviewId");
  if (!reviewId) {
    return jsonError("reviewId gerekli.", 400, { code: "missing_id" });
  }

  const deleted = await deleteReview(user.id, reviewId);
  if (!deleted) {
    return jsonError("İnceleme bulunamadı.", 404, { code: "not_found" });
  }
  return jsonOk({ ok: true });
}
