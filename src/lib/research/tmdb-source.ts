import "server-only";

import { env } from "@/lib/env";
import { providerFetchJson } from "@/lib/providers/http";
import { detectSpoilerRisk } from "@/lib/spoilers/risk";
import type { ResearchSourceItem } from "./wikipedia-source";

/**
 * TMDB kullanici incelemeleri. YALNIZCA TMDB_READ_TOKEN tanimliysa calisir;
 * anahtar yoksa hicbir istek gonderilmez ve bos liste doner.
 *
 * TMDB kullanici incelemeleri son kullanici tarafindan yazilmistir; kaynak
 * olarak TMDB ve yazarin adi belirtilir. Icerik kisaltilarak (<= 700 karakter)
 * saklanir.
 */

const EXCERPT_LIMIT = 700;

type TmdbReview = {
  id: string;
  author?: string;
  content?: string;
  created_at?: string;
  url?: string;
};

export function tmdbReviewsAvailable(): boolean {
  return Boolean(env.tmdbReadToken);
}

export async function fetchTmdbReviews(
  tmdbId: string,
  kind: "movie" | "series",
): Promise<ResearchSourceItem[]> {
  const token = env.tmdbReadToken;
  if (!token) return [];

  const mediaType = kind === "series" ? "tv" : "movie";
  const url =
    `https://api.themoviedb.org/3/${mediaType}/${encodeURIComponent(tmdbId)}` +
    `/reviews?language=tr-TR&page=1`;

  let data: { results?: TmdbReview[] };
  try {
    ({ data } = await providerFetchJson<{
      results?: TmdbReview[];
    }>({
      provider: "tmdb",
      url,
      headers: { Authorization: `Bearer ${token}` },
      cacheTtlSeconds: 60 * 60 * 24,
    }));
  } catch {
    return [];
  }

  const reviews = data.results ?? [];
  return reviews
    .filter((review) => (review.content?.trim().length ?? 0) >= 80)
    .slice(0, 10)
    .map((review) => {
      const content = (review.content ?? "").replace(/\s+/g, " ").trim();
      return {
        sourceName: "TMDB",
        sourceUrl: review.url ?? `https://www.themoviedb.org/review/${review.id}`,
        heading: "Kullanıcı incelemesi",
        excerpt: content.slice(0, EXCERPT_LIMIT),
        author: review.author ?? null,
        publishedAt: review.created_at?.slice(0, 10) ?? null,
        licenseNote: "TMDB API — kullanıcı incelemesi (yalnızca kısa alıntı)",
        spoilerRisk: detectSpoilerRisk(content),
      } satisfies ResearchSourceItem;
    });
}
