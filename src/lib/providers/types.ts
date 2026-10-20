/**
 * Saglayicilardan gelen verinin uygulama ici ortak bicimi.
 * Tum alanlar "kanit" niteligindedir; hicbiri tahminle doldurulmaz.
 */

export type TitleKind = "movie" | "series" | "season" | "episode" | "franchise";

export type SearchResult = {
  provider: string;
  providerId: string;
  kind: TitleKind;
  originalTitle: string;
  localizedTitle: string | null;
  releaseYear: number | null;
  releaseDate: string | null;
  overview: string | null;
  posterUrl: string | null;
  imdbId: string | null;
  externalRating: number | null;
  externalRatingCount: number | null;
  externalRatingSource: string | null;
  /** Eslesme guveni 0..1 (isim benzerligi + yil). */
  matchScore: number;
  /** Kaynagin kendi sayfasi (atif icin). */
  sourceUrl: string | null;
};

export type CreditItem = {
  name: string;
  role: "director" | "writer" | "actor" | "creator" | "composer";
  characterName?: string | null;
  billingOrder?: number | null;
  providerId?: string | null;
};

export type SeasonSummary = {
  providerId: string;
  seasonNumber: number;
  name: string | null;
  episodeCount: number | null;
  premiereDate: string | null;
  endDate: string | null;
  posterUrl: string | null;
};

export type TitleDetails = {
  provider: string;
  providerId: string;
  kind: TitleKind;
  originalTitle: string;
  localizedTitle: string | null;
  originalLanguage: string | null;
  overview: string | null;
  releaseDate: string | null;
  releaseYear: number | null;
  endDate: string | null;
  runtimeMinutes: number | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  homepageUrl: string | null;
  imdbId: string | null;
  wikidataId: string | null;
  tmdbId: string | null;
  tvmazeId: string | null;
  genres: string[];
  countries: string[];
  languages: string[];
  credits: CreditItem[];
  aliases: { name: string; language: string | null }[];
  seasons: SeasonSummary[];
  externalRating: number | null;
  externalRatingCount: number | null;
  externalRatingSource: string | null;
  sourceUrl: string | null;
  /** Kaynakta gercekten bulunan alanlar; arayuzde "dogrulanmis" isareti icin. */
  verifiedFields: string[];
};

export type ProviderSearchOutcome = {
  provider: string;
  results: SearchResult[];
  error: string | null;
  fromCache: boolean;
};
