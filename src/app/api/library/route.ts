import { z } from "zod";

import { WATCH_STATUSES } from "@/lib/db/schema";
import { requireUser, UnauthorizedError } from "@/lib/auth/current-user";
import { getTitleById } from "@/lib/catalog/service";
import {
  deleteLibraryEntry,
  getLibraryStats,
  listLibrary,
  upsertLibraryEntry,
} from "@/lib/library/service";
import { jsonError, jsonOk, parseJsonBody } from "@/lib/http";

export async function GET(request: Request) {
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
  const statusParam = url.searchParams.get("status");
  const status =
    statusParam && (WATCH_STATUSES as readonly string[]).includes(statusParam)
      ? (statusParam as (typeof WATCH_STATUSES)[number])
      : undefined;

  const limit = Number(url.searchParams.get("limit") ?? 50);
  const offset = Number(url.searchParams.get("offset") ?? 0);

  const [library, stats] = await Promise.all([
    listLibrary(user.id, {
      status,
      limit: Number.isFinite(limit) ? limit : 50,
      offset: Number.isFinite(offset) ? offset : 0,
    }),
    getLibraryStats(user.id),
  ]);

  return jsonOk({ ...library, stats });
}

const upsertSchema = z.object({
  titleId: z.string().trim().min(1),
  status: z.enum(WATCH_STATUSES).optional(),
  rating: z.number().min(1).max(10).nullable().optional(),
  watchedAt: z.string().trim().max(40).nullable().optional(),
  watchedPeriod: z.string().trim().max(80).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  likedAspects: z.string().max(2000).nullable().optional(),
  dislikedAspects: z.string().max(2000).nullable().optional(),
  memorableScenes: z.string().max(2000).nullable().optional(),
  rewatchIntent: z.enum(["yes", "maybe", "no"]).nullable().optional(),
  progressSeason: z.number().int().min(0).max(200).nullable().optional(),
  progressEpisode: z.number().int().min(0).max(5000).nullable().optional(),
  isFavorite: z.boolean().optional(),
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

  const parsed = await parseJsonBody(request, upsertSchema);
  if (!parsed.success) return parsed.response;

  const title = await getTitleById(parsed.data.titleId);
  if (!title) {
    return jsonError("Yapım bulunamadı.", 404, { code: "title_not_found" });
  }

  const result = await upsertLibraryEntry(user.id, parsed.data);

  return jsonOk(
    { entryId: result.id, created: result.created },
    result.created ? 201 : 200,
  );
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
  const entryId = url.searchParams.get("entryId");
  if (!entryId) {
    return jsonError("entryId gerekli.", 400, { code: "missing_entry_id" });
  }

  const deleted = await deleteLibraryEntry(user.id, entryId);
  if (!deleted) {
    return jsonError("Kayıt bulunamadı.", 404, { code: "entry_not_found" });
  }

  return jsonOk({ ok: true });
}
