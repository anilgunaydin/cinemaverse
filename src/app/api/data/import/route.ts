import { z } from "zod";

import { requireUser, UnauthorizedError } from "@/lib/auth/current-user";
import { WATCH_STATUSES } from "@/lib/db/schema";
import { jsonError, jsonOk, rateLimit } from "@/lib/http";
import { csvToObjects } from "@/lib/data/csv";
import { importUserData } from "@/lib/data/service";
import type { ExportLibraryEntry, ExportReviewEntry } from "@/lib/data/types";

function emptyToNull(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return value;
}

const nullableNumber = z.preprocess(emptyToNull, z.coerce.number().nullable());
const nullableString = z.preprocess(emptyToNull, z.string().nullable());
const nullableBoolean = z.preprocess(
  (value) => {
    const normalized = emptyToNull(value);
    if (normalized === null) return false;
    if (typeof normalized === "string") {
      return ["1", "true", "evet", "yes", "on"].includes(normalized.toLowerCase());
    }
    return normalized;
  },
  z.boolean(),
);

const libraryEntrySchema = z.object({
  imdbId: nullableString.optional().default(null),
  tmdbId: nullableString.optional().default(null),
  tvmazeId: nullableString.optional().default(null),
  wikidataId: nullableString.optional().default(null),
  titleName: z.string().trim().min(1).max(300),
  releaseYear: nullableNumber.optional().default(null),
  kind: z.string().optional().default(""),
  status: z.enum(WATCH_STATUSES).default("not_watched"),
  rating: nullableNumber.optional().default(null),
  watchedAt: nullableString.optional().default(null),
  watchedPeriod: nullableString.optional().default(null),
  notes: nullableString.optional().default(null),
  likedAspects: nullableString.optional().default(null),
  dislikedAspects: nullableString.optional().default(null),
  memorableScenes: nullableString.optional().default(null),
  rewatchIntent: z
    .preprocess(emptyToNull, z.enum(["yes", "maybe", "no"]).nullable())
    .optional()
    .default(null),
  progressSeason: nullableNumber.optional().default(null),
  progressEpisode: nullableNumber.optional().default(null),
  isFavorite: nullableBoolean.optional().default(false),
});

const reviewEntrySchema = z.object({
  titleName: z.string().trim().min(1).max(300),
  releaseYear: nullableNumber.optional().default(null),
  imdbId: nullableString.optional().default(null),
  body: z.string().max(20000),
  rating: nullableNumber.optional().default(null),
  containsSpoiler: nullableBoolean.optional().default(false),
  visibility: z.enum(["private", "followers", "public"]).default("public"),
  createdAt: z.string().optional().default(""),
});

const payloadSchema = z.object({
  library: z.array(libraryEntrySchema).max(5000).default([]),
  reviews: z.array(reviewEntrySchema).max(5000).default([]),
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

  const limit = rateLimit(`import:${user.id}`, 5, 60_000);
  if (!limit.allowed) {
    return jsonError("Çok sık içe aktarma yapılıyor. Lütfen bekleyin.", 429, {
      code: "rate_limited",
    });
  }

  const contentType = request.headers.get("content-type") ?? "";
  const raw = await request.text();

  let libraryInput: unknown[] = [];
  let reviewsInput: unknown[] = [];

  if (contentType.includes("csv") || contentType.includes("text/plain")) {
    libraryInput = csvToObjects(raw);
  } else {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      return jsonError("Geçersiz JSON veya CSV içeriği.", 400, {
        code: "invalid_content",
      });
    }
    // Hem tam yedek dosyası hem de sadece kütüphane dizisi kabul edilir.
    if (Array.isArray(parsedJson)) {
      libraryInput = parsedJson;
    } else if (parsedJson && typeof parsedJson === "object") {
      const object = parsedJson as Record<string, unknown>;
      libraryInput = Array.isArray(object.library) ? object.library : [];
      reviewsInput = Array.isArray(object.reviews) ? object.reviews : [];
    }
  }

  const parsed = payloadSchema.safeParse({
    library: libraryInput,
    reviews: reviewsInput,
  });
  if (!parsed.success) {
    return jsonError("İçe aktarma verisi doğrulanamadı.", 400, {
      code: "validation_error",
      details: parsed.error.issues.slice(0, 10).map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const summary = await importUserData(
    user.id,
    parsed.data.library as ExportLibraryEntry[],
    parsed.data.reviews as ExportReviewEntry[],
  );

  return jsonOk(summary);
}
