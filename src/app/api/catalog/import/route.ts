import { z } from "zod";

import { importTitle } from "@/lib/catalog/service";
import { requireUser, UnauthorizedError } from "@/lib/auth/current-user";
import { jsonError, jsonOk, parseJsonBody, rateLimit } from "@/lib/http";

const importSchema = z.object({
  provider: z.enum(["wikidata", "tvmaze"]),
  providerId: z.string().trim().min(1).max(64),
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

  const limit = rateLimit(`import:${user.id}`, 30, 60_000);
  if (!limit.allowed) {
    return jsonError("Çok fazla içe aktarma isteği. Lütfen bekleyin.", 429, {
      code: "rate_limited",
    });
  }

  const parsed = await parseJsonBody(request, importSchema);
  if (!parsed.success) return parsed.response;

  try {
    const result = await importTitle({
      provider: parsed.data.provider,
      providerId: parsed.data.providerId,
      language: "tr",
    });

    return jsonOk(
      {
        titleId: result.titleId,
        created: result.created,
        title: {
          originalTitle: result.details.originalTitle,
          releaseYear: result.details.releaseYear,
          kind: result.details.kind,
        },
        verifiedFields: result.details.verifiedFields,
      },
      result.created ? 201 : 200,
    );
  } catch (error) {
    return jsonError(
      error instanceof Error
        ? `Yapım kaydedilemedi: ${error.message}`
        : "Yapım kaydedilemedi.",
      502,
      { code: "import_failed" },
    );
  }
}
