import { z } from "zod";

import { requireUser, UnauthorizedError } from "@/lib/auth/current-user";
import { deleteFranchise, getFranchiseDetail, updateFranchise } from "@/lib/community/franchises";
import { jsonError, jsonOk, parseJsonBody } from "@/lib/http";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const franchise = await getFranchiseDetail(id);
  if (!franchise) {
    return jsonError("Franchise bulunamadı.", 404, { code: "not_found" });
  }
  return jsonOk({ franchise });
}

const updateFranchiseSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  wikidataId: z.string().trim().min(1).nullable().optional(),
});

export async function PATCH(
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

  const isModerator = user.role === "admin" || user.role === "moderator";
  if (!isModerator) {
    return jsonError("Bu işlem için moderatör yetkisi gereklidir.", 403, { code: "forbidden" });
  }

  const { id } = await params;
  const parsed = await parseJsonBody(request, updateFranchiseSchema);
  if (!parsed.success) return parsed.response;

  const result = await updateFranchise(id, parsed.data);
  if (!result.ok) {
    return jsonError("Franchise bulunamadı.", 404, { code: "not_found" });
  }
  return jsonOk({ ok: true });
}

export async function DELETE(
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

  const isModerator = user.role === "admin" || user.role === "moderator";
  if (!isModerator) {
    return jsonError("Bu işlem için moderatör yetkisi gereklidir.", 403, { code: "forbidden" });
  }

  const { id } = await params;
  const deleted = await deleteFranchise(id);
  if (!deleted) {
    return jsonError("Franchise bulunamadı.", 404, { code: "not_found" });
  }
  return jsonOk({ ok: true });
}