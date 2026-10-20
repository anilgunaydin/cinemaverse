import { z } from "zod";

import { requireUser, UnauthorizedError } from "@/lib/auth/current-user";
import { getMuted, muteUser, unmuteUser } from "@/lib/community/social";
import { jsonError, jsonOk, parseJsonBody, rateLimit } from "@/lib/http";

const muteSchema = z.object({
  targetUserId: z.string().trim().min(1),
});

export async function GET() {
  const user = await requireUser();
  const items = await getMuted(user.id, 50);
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

  const limit = rateLimit(`mute:${user.id}`, 20, 60_000);
  if (!limit.allowed) {
    return jsonError("Çok sık sessize alınıyor.", 429, { code: "rate_limited" });
  }

  const parsed = await parseJsonBody(request, muteSchema);
  if (!parsed.success) return parsed.response;

  if (parsed.data.targetUserId === user.id) {
    return jsonError("Kendinizi sessize alamazsınız.", 400, { code: "self_mute" });
  }

  const result = await muteUser(user.id, parsed.data.targetUserId);
  if (!result.ok) {
    return jsonError(
      result.reason === "self" ? "Kendinizi sessize alamazsınız." : "Zaten sessize alıyorsunuz.",
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

  const removed = await unmuteUser(user.id, targetUserId);
  if (!removed) {
    return jsonError("Sessize alma bulunamadı.", 404, { code: "not_found" });
  }
  return jsonOk({ ok: true });
}