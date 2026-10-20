import "server-only";

import { providerFetchJson } from "./http";
import type {
  CreditItem,
  ProviderSearchOutcome,
  SearchResult,
  SeasonSummary,
  TitleDetails,
} from "./types";
import { normalizeTitle } from "@/lib/catalog/matching";

const BASE = "https://api.tvmaze.com";

type TvMazeImage = { medium?: string; original?: string } | null;

type TvMazeShow = {
  id: number;
  url?: string;
  name: string;
  type?: string;
  language?: string | null;
  genres?: string[];
  status?: string;
  runtime?: number | null;
  averageRuntime?: number | null;
  premiered?: string | null;
  ended?: string | null;
  officialSite?: string | null;
  rating?: { average?: number | null };
  network?: { name?: string; country?: { name?: string; code?: string } } | null;
  webChannel?: { name?: string; country?: { name?: string; code?: string } } | null;
  externals?: { imdb?: string | null; thetvdb?: number | null };
  image?: TvMazeImage;
  summary?: string | null;
};

type TvMazeSeason = {
  id: number;
  number: number;
  name?: string;
  episodeOrder?: number | null;
  premiereDate?: string | null;
  endDate?: string | null;
  image?: TvMazeImage;
  summary?: string | null;
};

type TvMazeCast = {
  person: { id: number; name: string; url?: string };
  character: { id: number; name: string };
};

type TvMazeCrew = {
  type: string;
  person: { id: number; name: string };
};

type TvMazeAka = {
  name: string;
  country?: { code?: string; name?: string } | null;
};

type TvMazeSearchItem = {
  score: number;
  show: TvMazeShow;
};

/** TVmaze ozetleri HTML icerir; duz metne cevrilir. */
function stripHtml(input: string | null | undefined): string | null {
  if (!input) return null;
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function yearOf(date: string | null | undefined): number | null {
  if (!date) return null;
  const year = Number(date.slice(0, 4));
  return Number.isFinite(year) && year > 1800 ? year : null;
}

export async function searchTvmaze(
  query: string,
): Promise<ProviderSearchOutcome> {
  try {
    // Normalize query for better matching (Turkish chars -> ASCII)
    const normalizedQuery = normalizeTitle(query);
    const { data } = await providerFetchJson<TvMazeSearchItem[]>({
      provider: "tvmaze",
      url: `${BASE}/search/shows?q=${encodeURIComponent(normalizedQuery)}`,
      cacheTtlSeconds: 60 * 60 * 24,
    });

    const results: SearchResult[] = data.slice(0, 20).map((item) => ({
      provider: "tvmaze",
      providerId: String(item.show.id),
      kind: "series",
      originalTitle: item.show.name,
      localizedTitle: null,
      releaseYear: yearOf(item.show.premiered),
      releaseDate: item.show.premiered ?? null,
      overview: stripHtml(item.show.summary),
      posterUrl: item.show.image?.original ?? item.show.image?.medium ?? null,
      imdbId: item.show.externals?.imdb ?? null,
      externalRating: item.show.rating?.average ?? null,
      externalRatingCount: null,
      externalRatingSource: "tvmaze",
      matchScore: 0,
      sourceUrl: item.show.url ?? `https://www.tvmaze.com/shows/${item.show.id}`,
    }));

    return {
      provider: "tvmaze",
      results,
      error: null,
      fromCache: false,
    };
  } catch (error) {
    return {
      provider: "tvmaze",
      results: [],
      error: error instanceof Error ? error.message : "TVmaze aramasi basarisiz.",
      fromCache: false,
    };
  }
}

export async function getTvmazeDetails(
  showId: string,
): Promise<TitleDetails> {
  const [showResult, seasonsResult, castResult, crewResult, akasResult, imagesResult] =
    await Promise.allSettled([
      providerFetchJson<TvMazeShow>({
        provider: "tvmaze",
        url: `${BASE}/shows/${showId}`,
        cacheTtlSeconds: 60 * 60 * 24,
      }),
      providerFetchJson<TvMazeSeason[]>({
        provider: "tvmaze",
        url: `${BASE}/shows/${showId}/seasons`,
        cacheTtlSeconds: 60 * 60 * 24,
      }),
      providerFetchJson<TvMazeCast[]>({
        provider: "tvmaze",
        url: `${BASE}/shows/${showId}/cast`,
        cacheTtlSeconds: 60 * 60 * 24,
      }),
      providerFetchJson<TvMazeCrew[]>({
        provider: "tvmaze",
        url: `${BASE}/shows/${showId}/crew`,
        cacheTtlSeconds: 60 * 60 * 24,
      }),
      providerFetchJson<TvMazeAka[]>({
        provider: "tvmaze",
        url: `${BASE}/shows/${showId}/akas`,
        cacheTtlSeconds: 60 * 60 * 24,
      }),
      providerFetchJson<
        { type?: string; main?: boolean; resolutions?: { original?: { url?: string } } }[]
      >({
        provider: "tvmaze",
        url: `${BASE}/shows/${showId}/images`,
        cacheTtlSeconds: 60 * 60 * 24,
      }),
    ]);

  if (showResult.status === "rejected") {
    throw new Error(
      showResult.reason instanceof Error
        ? showResult.reason.message
        : "TVmaze detayi alinamadi.",
    );
  }

  const show = showResult.value.data;
  const seasons = seasonsResult.status === "fulfilled" ? seasonsResult.value.data : [];
  const cast = castResult.status === "fulfilled" ? castResult.value.data : [];
  const crew = crewResult.status === "fulfilled" ? crewResult.value.data : [];
  const akas = akasResult.status === "fulfilled" ? akasResult.value.data : [];
  const images = imagesResult.status === "fulfilled" ? imagesResult.value.data : [];

  const credits: CreditItem[] = [];

  // TVmaze "crew" kayitlari yonetmen/yapimci/besteci ayrimi icerir.
  crew.forEach((member, index) => {
    const type = member.type?.toLowerCase() ?? "";
    if (type.includes("creator") || type.includes("writer")) {
      credits.push({
        name: member.person.name,
        role: type.includes("creator") ? "creator" : "writer",
        providerId: `tvmaze-person-${member.person.id}`,
        billingOrder: index,
      });
    } else if (type.includes("director")) {
      credits.push({
        name: member.person.name,
        role: "director",
        providerId: `tvmaze-person-${member.person.id}`,
        billingOrder: index,
      });
    } else if (type.includes("composer") || type.includes("music")) {
      credits.push({
        name: member.person.name,
        role: "composer",
        providerId: `tvmaze-person-${member.person.id}`,
        billingOrder: index,
      });
    }
  });

  cast.slice(0, 40).forEach((member, index) => {
    credits.push({
      name: member.person.name,
      role: "actor",
      characterName: member.character?.name ?? null,
      billingOrder: index,
      providerId: `tvmaze-person-${member.person.id}`,
    });
  });

  const posterFromImages =
    images.find((img) => img.type === "poster" && img.main)?.resolutions?.original?.url ??
    images.find((img) => img.type === "poster")?.resolutions?.original?.url ??
    null;
  const backdropFromImages =
    images.find((img) => img.type === "background")?.resolutions?.original?.url ?? null;

  const country =
    show.network?.country?.name ?? show.webChannel?.country?.name ?? null;

  const seasonSummaries: SeasonSummary[] = seasons.map((season) => ({
    providerId: String(season.id),
    seasonNumber: season.number,
    name: season.name && season.name.length > 0 ? season.name : null,
    episodeCount: season.episodeOrder ?? null,
    premiereDate: season.premiereDate ?? null,
    endDate: season.endDate ?? null,
    posterUrl: season.image?.original ?? season.image?.medium ?? null,
  }));

  const verifiedFields = ["originalTitle", "tvmazeId", "seasons"];
  if (show.summary) verifiedFields.push("overview");
  if (show.premiered) verifiedFields.push("releaseDate");
  if (credits.length) verifiedFields.push("credits");
  if (show.genres?.length) verifiedFields.push("genres");
  if (show.officialSite) verifiedFields.push("homepageUrl");

  return {
    provider: "tvmaze",
    providerId: String(show.id),
    kind: "series",
    originalTitle: show.name,
    localizedTitle: null,
    originalLanguage: show.language ?? null,
    overview: stripHtml(show.summary),
    releaseDate: show.premiered ?? null,
    releaseYear: yearOf(show.premiered),
    endDate: show.ended ?? null,
    runtimeMinutes: show.averageRuntime ?? show.runtime ?? null,
    posterUrl: show.image?.original ?? show.image?.medium ?? posterFromImages,
    backdropUrl: backdropFromImages,
    homepageUrl: show.officialSite ?? null,
    imdbId: show.externals?.imdb ?? null,
    wikidataId: null,
    tmdbId: null,
    tvmazeId: String(show.id),
    genres: show.genres ?? [],
    countries: country ? [country] : [],
    languages: show.language ? [show.language] : [],
    credits,
    aliases: akas.map((aka) => ({
      name: aka.name,
      language: aka.country?.code ?? null,
    })),
    seasons: seasonSummaries,
    externalRating: show.rating?.average ?? null,
    externalRatingCount: null,
    externalRatingSource: "tvmaze",
    sourceUrl: show.url ?? `https://www.tvmaze.com/shows/${show.id}`,
    verifiedFields,
  };
}
