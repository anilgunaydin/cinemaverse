import { z } from "zod";

import { requireUser, UnauthorizedError } from "@/lib/auth/current-user";
import {
  createConversation,
  deleteConversation,
  listConversations,
} from "@/lib/ai/conversation";
import { jsonError, jsonOk, parseJsonBody, rateLimit } from "@/lib/http";

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
  const titleId = url.searchParams.get("titleId") ?? undefined;
  const conversations = await listConversations(user.id, titleId);
  return jsonOk({ conversations });
}

const createSchema = z.object({
  titleId: z.string().trim().min(1).nullable().optional(),
  heading: z.string().trim().min(1).max(200),
  spoilerMode: z.enum(["none", "progress", "season", "all"]).optional(),
  spoilerSeason: z.number().int().min(0).max(100).nullable().optional(),
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

  const limit = rateLimit(`ai-conv:${user.id}`, 20, 60_000);
  if (!limit.allowed) {
    return jsonError("Çok sık yeni tartışma açılıyor.", 429, {
      code: "rate_limited",
    });
  }

  const parsed = await parseJsonBody(request, createSchema);
  if (!parsed.success) return parsed.response;

  const conversation = await createConversation(user.id, parsed.data);
  return jsonOk({ conversation }, 201);
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
  const conversationId = url.searchParams.get("conversationId");
  if (!conversationId) {
    return jsonError("conversationId gerekli.", 400, { code: "missing_id" });
  }

  const deleted = await deleteConversation(user.id, conversationId);
  if (!deleted) {
    return jsonError("Tartışma bulunamadı.", 404, { code: "not_found" });
  }
  return jsonOk({ ok: true });
}
