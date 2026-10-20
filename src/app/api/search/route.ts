import { z } from "zod";

import { searchCatalog } from "@/lib/catalog/service";
import { jsonError, jsonOk, rateLimit } from "@/lib/http";

const querySchema = z.object({
  q: z.string().trim().min(2, "En az 2 karakter girin.").max(120),
  kind: z.enum(["movie", "series", "all"]).default("all"),
  year: z.coerce.number().int().min(1880).max(2100).optional(),
});

export async function GET(request: Request) {
  const limit = rateLimit("search", 40, 60_000);
  if (!limit.allowed) {
    return jsonError("Çok fazla arama. Lütfen kısa bir süre bekleyin.", 429, {
      code: "rate_limited",
    });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    q: url.searchParams.get("q") ?? "",
    kind: url.searchParams.get("kind") ?? "all",
    year: url.searchParams.get("year") ?? undefined,
  });

  if (!parsed.success) {
    return jsonError("Arama parametreleri geçersiz.", 400, {
      code: "validation_error",
      details: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const { q, kind, year } = parsed.data;

  const outcome = await searchCatalog({
    query: q,
    kind,
    year: year ?? null,
    language: "tr",
  });

  const allFailed =
    outcome.providerStatus.length > 0 &&
    outcome.providerStatus.every((status) => status.error !== null);

  if (allFailed) {
    return jsonError(
      "Arama kaynaklarına şu anda ulaşılamıyor. İnternet bağlantınızı kontrol edip tekrar deneyin.",
      503,
      {
        code: "providers_unavailable",
        details: outcome.providerStatus.map((status) => ({
          provider: status.provider,
          error: status.error,
        })),
      },
    );
  }

  return jsonOk({
    query: q,
    results: outcome.results,
    providerStatus: outcome.providerStatus,
  });
}
