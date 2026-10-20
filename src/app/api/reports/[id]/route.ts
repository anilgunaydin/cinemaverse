import { z } from "zod";

import { requireUser, UnauthorizedError } from "@/lib/auth/current-user";
import { getReportDetail, resolveReport } from "@/lib/community/reports";
import { jsonError, jsonOk, parseJsonBody } from "@/lib/http";

export async function GET(
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

  const { id } = await params;
  const isModerator = user.role === "admin" || user.role === "moderator";
  const report = await getReportDetail(id, user.id, isModerator);
  if (!report) {
    return jsonError("Rapor bulunamadı veya yetkiniz yok.", 404, { code: "not_found" });
  }
  return jsonOk({ report });
}

const resolveSchema = z.object({
  status: z.enum(["resolved", "dismissed"]),
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
  const parsed = await parseJsonBody(request, resolveSchema);
  if (!parsed.success) return parsed.response;

  const result = await resolveReport(user.id, id, parsed.data.status);
  if (!result.ok) {
    return jsonError("Rapor bulunamadı.", 404, { code: "not_found" });
  }
  return jsonOk({ ok: true });
}