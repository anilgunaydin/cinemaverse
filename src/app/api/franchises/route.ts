import { z } from "zod";

import { requireUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createFranchise, listFranchises } from "@/lib/community/franchises";
import { jsonError, jsonOk, parseJsonBody, rateLimit } from "@/lib/http";

export async function GET() {
  const items = await listFranchises(50);
  return jsonOk({ items });
}

const createFranchiseSchema = z.object({
  name: z.string().trim().min(1).max(200),
  wikidataId: z.string().trim().min(1).nullable().optional(),
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

  const isModerator = user.role === "admin" || user.role === "moderator";
  if (!isModerator) {
    return jsonError("Bu işlem için moderatör yetkisi gereklidir.", 403, { code: "forbidden" });
  }

  const limit = rateLimit(`franchise:${user.id}`, 10, 60_000);
  if (!limit.allowed) {
    return jsonError("Çok sık franchise oluşturuluyor.", 429, { code: "rate_limited" });
  }

  const parsed = await parseJsonBody(request, createFranchiseSchema);
  if (!parsed.success) return parsed.response;

  const result = await createFranchise(parsed.data);
  return jsonOk({ franchiseId: result.id }, 201);
}