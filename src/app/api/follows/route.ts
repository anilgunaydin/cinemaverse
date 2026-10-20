import { z } from "zod";

import { requireUser, UnauthorizedError } from "@/lib/auth/current-user";
import { followUser, getFollowers, getFollowing, unfollowUser } from "@/lib/community/social";
import { jsonError, jsonOk, parseJsonBody, rateLimit } from "@/lib/http";

export async function GET(request: Request) {
  const user = await requireUser();
  const url = new URL(request.url);
  const targetUserId = url.searchParams.get("userId") ?? user.id;
  const type = url.searchParams.get("type") ?? "followers";

  if (type === "following") {
    const items = await getFollowing(targetUserId, 50);
    return jsonOk({ items });
  }

  const items = await getFollowers(targetUserId, 50);
  return jsonOk({ items });
}

const followSchema = z.object({
  targetUserId: z.string().trim().min(1),
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

  const limit = rateLimit(`follow:${user.id}`, 30, 60_000);
  if (!limit.allowed) {
    return jsonError("Çok sık takip ediliyor.", 429, { code: "rate_limited" });
  }

  const parsed = await parseJsonBody(request, followSchema);
  if (!parsed.success) return parsed.response;

  if (parsed.data.targetUserId === user.id) {
    return jsonError("Kendinizi takip edemezsiniz.", 400, { code: "self_follow" });
  }

  const result = await followUser(user.id, parsed.data.targetUserId);
  if (!result.ok) {
    return jsonError(
      result.reason === "self" ? "Kendinizi takip edemezsiniz." : "Zaten takip ediyorsunuz.",
      400,
      { code: result.reason },
    );
  }
  return jsonOk({ ok: true }, 201);
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
  const targetUserId = url.searchParams.get("targetUserId");
  if (!targetUserId) {
    return jsonError("targetUserId gerekli.", 400, { code: "missing_id" });
  }

  const removed = await unfollowUser(user.id, targetUserId);
  if (!removed) {
    return jsonError("Takip bulunamadı.", 404, { code: "not_found" });
  }
  return jsonOk({ ok: true });
}