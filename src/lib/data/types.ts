import type { WatchStatus } from "@/lib/db/schema";

/** Disa aktarma/ice aktarma dosya bicimleri. */

export const EXPORT_FORMAT = "cinemaverse.export";
export const EXPORT_VERSION = 1;

export type ExportLibraryEntry = {
  imdbId: string | null;
  tmdbId: string | null;
  tvmazeId: string | null;
  wikidataId: string | null;
  titleName: string;
  releaseYear: number | null;
  kind: string;
  status: WatchStatus;
  rating: number | null;
  watchedAt: string | null;
  watchedPeriod: string | null;
  notes: string | null;
  likedAspects: string | null;
  dislikedAspects: string | null;
  memorableScenes: string | null;
  rewatchIntent: "yes" | "maybe" | "no" | null;
  progressSeason: number | null;
  progressEpisode: number | null;
  isFavorite: boolean;
};

export type ExportReviewEntry = {
  titleName: string;
  releaseYear: number | null;
  imdbId: string | null;
  body: string;
  rating: number | null;
  containsSpoiler: boolean;
  visibility: "private" | "followers" | "public";
  createdAt: string;
};

export type ExportPayload = {
  format: typeof EXPORT_FORMAT;
  version: number;
  exportedAt: string;
  user: { displayName: string; email: string };
  library: ExportLibraryEntry[];
  reviews: ExportReviewEntry[];
};

export type ImportSummary = {
  libraryImported: number;
  librarySkipped: { titleName: string; reason: string }[];
  reviewsImported: number;
  reviewsSkipped: { titleName: string; reason: string }[];
};
