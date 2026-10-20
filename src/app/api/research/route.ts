import { z } from "zod";

import { requireUser, UnauthorizedError } from "@/lib/auth/current-user";
import { jsonError, jsonOk, parseJsonBody, rateLimit } from "@/lib/http";
import {
  getResearchSession,
  listResearchSessions,
  runResearch,
  TitleNotFoundError,
} from "@/lib/research/service";

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
  const sessionId = url.searchParams.get("sessionId");
  if (sessionId) {
    const session = await getResearchSession(user.id, sessionId);
    if (!session) {
      return jsonError("Araştırma oturumu bulunamadı.", 404, {
        code: "not_found",
      });
    }
    return jsonOk({ session });
  }

  const titleId = url.searchParams.get("titleId") ?? undefined;
  const sessions = await listResearchSessions(user.id, titleId);
  return jsonOk({ sessions });
}

const runSchema = z.object({
  titleId: z.string().trim().min(1),
  question: z.string().trim().max(500).optional(),
  withAiSummary: z.boolean().optional(),
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

  const limit = rateLimit(`research:${user.id}`, 12, 60_000);
  if (!limit.allowed) {
    return jsonError("Çok sık araştırma başlatılıyor. Lütfen bekleyin.", 429, {
      code: "rate_limited",
    });
  }

  const parsed = await parseJsonBody(request, runSchema);
  if (!parsed.success) return parsed.response;

  try {
    const outcome = await runResearch(user.id, parsed.data.titleId, {
      question: parsed.data.question,
      withAiSummary: parsed.data.withAiSummary,
    });
    return jsonOk(outcome);
  } catch (error) {
    if (error instanceof TitleNotFoundError) {
      return jsonError(error.message, 404, { code: "title_not_found" });
    }
    throw error;
  }
}
