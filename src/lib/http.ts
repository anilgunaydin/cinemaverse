import "server-only";

import crypto from "node:crypto";
import { z } from "zod";

/** API yanitlarinda kullanilan ortak hata bicimi. */
export type ApiError = {
  error: string;
  code?: string;
  details?: unknown;
};

export function jsonError(
  message: string,
  status: number,
  options?: { code?: string; details?: unknown },
): Response {
  const body: ApiError = { error: message };
  if (options?.code) body.code = options.code;
  if (options?.details !== undefined) body.details = options.details;
  return Response.json(body, { status });
}

export function jsonOk<T>(data: T, status = 200): Response {
  return Response.json(data, { status });
}

export function newId(prefix = "id"): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Govdeyi guvenli sekilde okur ve zod semasi ile dogrular.
 * Hata durumunda Turkce alan bazli mesaj dondurur.
 */
export async function parseJsonBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<
  { success: true; data: z.infer<T> } | { success: false; response: Response }
> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      success: false,
      response: jsonError("Gecersiz JSON govdesi.", 400, {
        code: "invalid_json",
      }),
    };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      response: jsonError("Girdi dogrulanamadi.", 400, {
        code: "validation_error",
        details: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      }),
    };
  }

  return { success: true, data: parsed.data };
}

/**
 * Basit bellek ici hiz sinirlayici. Tek surec icin yeterlidir; coklu
 * ornek dagitimi icin Redis/Postgres tabanli cozum gerekir.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/** HTML etiketlerini temizler; kullanici metinleri duz metin olarak saklanir. */
export function sanitizePlainText(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/\u0000/g, "")
    .trim();
}

export function normalizeForHash(input: string): string {
  return input
    .toLowerCase()
    .replace(/[\s\u00a0]+/g, " ")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .trim();
}

export function contentHash(...parts: string[]): string {
  return crypto
    .createHash("sha256")
    .update(parts.map(normalizeForHash).join("|"))
    .digest("hex");
}
