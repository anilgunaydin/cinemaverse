import { z } from "zod";

import { requireUser, UnauthorizedError } from "@/lib/auth/current-user";
import { blockUser, getBlocked, unblockUser } from "@/lib/community/social";
import { jsonError, jsonOk, parseJsonBody, rateLimit } from "@/lib/http";

const blockSchema = z.object({
  targetUserId: z.string().trim().min(1),
});

export async function GET() {
  const user = await requireUser();
  const items = await getBlocked(user.id, 50);
  return jsonOk({ items });
}

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

  const limit = rateLimit(`block:${user.id}`, 20, 60_000);
  if (!limit.allowed) {
    return jsonError("Çok sık engelleniyor.", 429, { code: "rate_limited" });
  }

  const parsed = await parseJsonBody(request, blockSchema);
  if (!parsed.success) return parsed.response;

  if (parsed.data.targetUserId === user.id) {
    return jsonError("Kendinizi engelleyemezsiniz.", 400, { code: "self_block" });
  }

  const result = await blockUser(user.id, parsed.data.targetUserId);
  if (!result.ok) {
    return jsonError(
      result.reason === "self" ? "Kendinizi engelleyemezsiniz." : "Zaten engelliyorsunuz.",
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

  const removed = await unblockUser(user.id, targetUserId);
  if (!removed) {
    return jsonError("Engelleme bulunamadı.", 404, { code: "not_found" });
  }
  return jsonOk({ ok: true });
}