import "server-only";

import { providerFetchJson } from "./http";
import type {
  CreditItem,
  ProviderSearchOutcome,
  SearchResult,
  SeasonSummary,
  TitleDetails,
  TitleKind,
} from "./types";
import { normalizeTitle } from "@/lib/catalog/matching";

const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";
const API_ENDPOINT = "https://www.wikidata.org/w/api.php";

/** Wikidata'da turleri temsil eden sabit kimlikler. */
const KIND_TO_QID: Record<string, string[]> = {
  movie: ["Q11424", "Q24869", "Q202866", "Q506240"],
  series: [
    "Q5398426",
    "Q581714",
    "Q63952888",
    "Q1259759",
    "Q15416",
    "Q117467246",
    "Q1734662",
  ],
};

const QID_TO_KIND: Record<string, TitleKind> = {
  Q11424: "movie",
  Q24869: "movie",
  Q202866: "movie",
  Q506240: "movie",
  Q5398426: "series",
  Q581714: "series",
  Q63952888: "series",
  Q1259759: "series",
  Q15416: "series",
  Q117467246: "series",
  Q1734662: "series",
};

type SparqlValue = { type: string; value: string; "xml:lang"?: string };
type SparqlBinding = Record<string, SparqlValue>;

async function runSparql(query: string): Promise<SparqlBinding[]> {
  const url = `${SPARQL_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
  const { data } = await providerFetchJson<{
    results: { bindings: SparqlBinding[] };
  }>({
    provider: "wikidata",
    url,
    headers: { Accept: "application/sparql-results+json" },
    cacheTtlSeconds: 60 * 60 * 24,
    timeoutMs: 20_000,
  });
  return data.results?.bindings ?? [];
}

function qidFromUri(uri: string): string {
  return uri.split("/").pop() ?? uri;
}

function yearFromDate(value: string | undefined): number | null {
  if (!value) return null;
  const match = /^[+-]?(\d{4})/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  return Number.isFinite(year) && year > 1800 && year < 2200 ? year : null;
}

function escapeSparqlLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/* -------------------------------------------------------------------------- */
/* Arama                                                                      */
/* -------------------------------------------------------------------------- */

export async function searchWikidata(
  query: string,
  kind: "movie" | "series",
  language: string,
): Promise<ProviderSearchOutcome> {
  const typeQids = KIND_TO_QID[kind];
  const valuesClause = typeQids.map((q) => `wd:${q}`).join(" ");
  
  // Normalize query for better matching (Turkish chars -> ASCII)
  const normalizedQuery = normalizeTitle(query);
  const escaped = escapeSparqlLiteral(normalizedQuery);

  const sparql = `
SELECT ?item ?labelEn ?labelTr ?itemDescription ?date ?imdb ?type WHERE {
  SERVICE wikibase:mwapi {
    bd:serviceParam wikibase:api "EntitySearch";
                    wikibase:endpoint "www.wikidata.org";
                    mwapi:search "${escaped}";
                    mwapi:language "${language === "tr" ? "tr" : "en"}".
    ?item wikibase:apiOutputItem mwapi:item.
  }
  ?item wdt:P31 ?type .
  VALUES ?type { ${valuesClause} }
  OPTIONAL { ?item rdfs:label ?labelEn FILTER(LANG(?labelEn) = "en") }
  OPTIONAL { ?item rdfs:label ?labelTr FILTER(LANG(?labelTr) = "tr") }
  OPTIONAL { ?item wdt:P345 ?imdb }
  OPTIONAL { ?item wdt:P577 ?date }
  OPTIONAL { ?item schema:description ?itemDescription FILTER(LANG(?itemDescription) = "${language === "tr" ? "tr" : "en"}") }
}
LIMIT 60`;

  try {
    const bindings = await runSparql(sparql);

    // Ayni QID birden fazla satirda gelebilir (coklu yayin tarihi).
    const byQid = new Map<string, SearchResult>();
    for (const binding of bindings) {
      const qid = qidFromUri(binding.item.value);
      if (byQid.has(qid)) {
        // En erken yayin tarihini koru.
        const existing = byQid.get(qid)!;
        const candidateYear = yearFromDate(binding.date?.value);
        if (
          candidateYear !== null &&
          (existing.releaseYear === null || candidateYear < existing.releaseYear)
        ) {
          existing.releaseYear = candidateYear;
        }
        continue;
      }
      const kindValue = QID_TO_KIND[qidFromUri(binding.type.value)] ?? kind;
      const englishLabel = binding.labelEn?.value ?? null;
      const turkishLabel = binding.labelTr?.value ?? null;
      // Sorgu dili ne olursa olsun, eslesme icin Ingilizce baslik da saklanir.
      const primaryTitle = englishLabel ?? turkishLabel ?? query;
      byQid.set(qid, {
        provider: "wikidata",
        providerId: qid,
        kind: kindValue,
        originalTitle: primaryTitle,
        localizedTitle:
          turkishLabel && turkishLabel !== primaryTitle ? turkishLabel : null,
        releaseYear: yearFromDate(binding.date?.value),
        releaseDate: binding.date?.value?.slice(0, 10) ?? null,
        overview: binding.itemDescription?.value ?? null,
        posterUrl: null,
        imdbId: binding.imdb?.value ?? null,
        externalRating: null,
        externalRatingCount: null,
        externalRatingSource: null,
        matchScore: 0,
        sourceUrl: `https://www.wikidata.org/wiki/${qid}`,
      });
    }

    return {
      provider: "wikidata",
      results: [...byQid.values()],
      error: null,
      fromCache: false,
    };
  } catch (error) {
    return {
      provider: "wikidata",
      results: [],
      error: error instanceof Error ? error.message : "Wikidata aramasi basarisiz.",
      fromCache: false,
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Detay                                                                      */
/* -------------------------------------------------------------------------- */

type WikidataEntity = {
  id: string;
  labels?: Record<string, { value: string }>;
  descriptions?: Record<string, { value: string }>;
  claims?: Record<string, WikidataClaim[]>;
  sitelinks?: Record<string, { title: string; url?: string }>;
};

type WikidataClaim = {
  rank?: string;
  mainsnak?: {
    datavalue?: { value: unknown; type: string };
  };
  qualifiers?: Record<string, WikidataClaim[]>;
};

function claimValues(entity: WikidataEntity, property: string): unknown[] {
  const claims = entity.claims?.[property] ?? [];
  return claims
    .filter((claim) => claim.rank !== "deprecated")
    .map((claim) => claim.mainsnak?.datavalue?.value)
    .filter((value): value is unknown => value !== undefined && value !== null);
}

function claimEntityIds(entity: WikidataEntity, property: string): string[] {
  return claimValues(entity, property)
    .map((value) => {
      if (typeof value === "object" && value !== null && "id" in value) {
        return String((value as { id: string }).id);
      }
      return null;
    })
    .filter((id): id is string => Boolean(id));
}

function claimStrings(entity: WikidataEntity, property: string): string[] {
  return claimValues(entity, property).filter(
    (value): value is string => typeof value === "string",
  );
}

function claimTimes(entity: WikidataEntity, property: string): string[] {
  return claimValues(entity, property)
    .map((value) => {
      if (typeof value === "object" && value !== null && "time" in value) {
        return String((value as { time: string }).time);
      }
      return null;
    })
    .filter((value): value is string => Boolean(value));
}

function claimQuantities(entity: WikidataEntity, property: string): number[] {
  return claimValues(entity, property)
    .map((value) => {
      if (typeof value === "object" && value !== null && "amount" in value) {
        return Number(String((value as { amount: string }).amount).replace("+", ""));
      }
      return null;
    })
    .filter((value): value is number => value !== null && Number.isFinite(value));
}

function formatWikidataTime(time: string): string | null {
  // +2010-07-08T00:00:00Z -> 2010-07-08
  const match = /^[+-]?(\d{4})-(\d{2})-(\d{2})/.exec(time);
  if (!match) return null;
  const [, year, month, day] = match;
  if (year === "0000") return null;
  if (month === "00") return `${year}`;
  if (day === "00") return `${year}-${month}`;
  return `${year}-${month}-${day}`;
}

type EntityLabelSet = {
  en: string | null;
  local: string | null;
  /**
   * en/tr etiketi yoksa kullanilacak yedek: once enwiki/trwiki basligi,
   * sonra herhangi bir dildeki etiket. Ikisi de yoksa null.
   */
  fallback: string | null;
};

/**
 * en/tr etiketi bulunmayan kayitlar icin yedek ad cozumu.
 * (Or. yalnizca baska dillerde etiketi olan oyuncular; bunlar daha once
 *  ekrana "Q131285" gibi ham kimlik olarak dusuyordu.)
 */
async function fetchFallbackLabels(
  ids: string[],
  language: string,
): Promise<Map<string, EntityLabelSet>> {
  const result = new Map<string, EntityLabelSet>();
  if (ids.length === 0) return result;

  const url =
    `${API_ENDPOINT}?action=wbgetentities&format=json` +
    `&props=labels|sitelinks&sitefilter=enwiki|${language}wiki` +
    `&ids=${ids.join("|")}`;
  try {
    const { data } = await providerFetchJson<{
      entities: Record<string, WikidataEntity>;
    }>({
      provider: "wikidata",
      url,
      cacheTtlSeconds: 60 * 60 * 24 * 7,
    });
    for (const [id, entity] of Object.entries(data.entities ?? {})) {
      const sitelink =
        entity.sitelinks?.[`${language}wiki`]?.title ??
        entity.sitelinks?.enwiki?.title ??
        null;
      const anyLabel =
        Object.values(entity.labels ?? {}).find(
          (entry) =>
            typeof entry?.value === "string" && entry.value.trim().length > 0,
        )?.value ?? null;
      const fallback = sitelink ?? anyLabel;
      if (fallback) result.set(id, { en: null, local: null, fallback });
    }
  } catch {
    // Yedek cozum de basarisiz olursa kimlik ile devam edilir.
  }
  return result;
}

async function fetchEntityLabels(
  ids: string[],
  language: string,
): Promise<Map<string, EntityLabelSet>> {
  const unique = [...new Set(ids)].filter(Boolean);
  const result = new Map<string, EntityLabelSet>();
  if (unique.length === 0) return result;

  // API en fazla 50 kimlik kabul eder.
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += 45) {
    chunks.push(unique.slice(i, i + 45));
  }

  for (const chunk of chunks) {
    const url =
      `${API_ENDPOINT}?action=wbgetentities&format=json&props=labels` +
      `&languages=en|${language}&ids=${chunk.join("|")}`;
    try {
      const { data } = await providerFetchJson<{
        entities: Record<string, WikidataEntity>;
      }>({
        provider: "wikidata",
        url,
        cacheTtlSeconds: 60 * 60 * 24 * 7,
      });
      const missing: string[] = [];
      for (const [id, entity] of Object.entries(data.entities ?? {})) {
        const en = entity.labels?.en?.value ?? null;
        const local = entity.labels?.[language]?.value ?? null;
        if (en || local) result.set(id, { en, local, fallback: null });
        else missing.push(id);
      }

      if (missing.length > 0) {
        const resolved = await fetchFallbackLabels(missing, language);
        for (const [id, entry] of resolved) result.set(id, entry);
      }
    } catch {
      // Etiket cozulemezse kimlik ile devam edilir.
    }
  }

  return result;
}

export async function getWikidataDetails(
  qid: string,
  language: string,
): Promise<TitleDetails> {
  // NOT: `languages` ve `sitefilter` verilmez; aksi halde API yalnizca o
  // dildeki etiketleri dondurur ve Turkce/Ingilizce etiketi olmayan
  // kayitlar etiketsiz (QID) kalir.
  const url =
    `${API_ENDPOINT}?action=wbgetentities&format=json&ids=${encodeURIComponent(qid)}` +
    `&props=labels|descriptions|claims|sitelinks`;

  const { data } = await providerFetchJson<{
    entities: Record<string, WikidataEntity>;
  }>({
    provider: "wikidata",
    url,
    cacheTtlSeconds: 60 * 60 * 24,
  });

  const entity = data.entities?.[qid];
  if (!entity) {
    throw new Error("Wikidata kaydi bulunamadi.");
  }

  const instanceOf = claimEntityIds(entity, "P31");
  const kind: TitleKind =
    instanceOf.map((id) => QID_TO_KIND[id]).find(Boolean) ?? "movie";

  // Etiketleri topluca coz.
  const personIds = [
    ...claimEntityIds(entity, "P57"), // yonetmen
    ...claimEntityIds(entity, "P58"), // senarist
    ...claimEntityIds(entity, "P161"), // oyuncu
    ...claimEntityIds(entity, "P162"), // yapimci
    ...claimEntityIds(entity, "P86"), // besteci
    ...claimEntityIds(entity, "P170"), // creator
  ];
  const genreIds = claimEntityIds(entity, "P136");
  const countryIds = claimEntityIds(entity, "P495");
  const languageIds = claimEntityIds(entity, "P364");

  const labelMap = await fetchEntityLabels(
    [...personIds, ...genreIds, ...countryIds, ...languageIds],
    language,
  );
  // Ekip/tur uluslararasi okunabilirlik icin Ingilizce etiketle gosterilir.
  const label = (id: string) =>
    labelMap.get(id)?.en ??
    labelMap.get(id)?.local ??
    labelMap.get(id)?.fallback ??
    id;
  const localLabel = (id: string) =>
    labelMap.get(id)?.local ??
    labelMap.get(id)?.en ??
    labelMap.get(id)?.fallback ??
    id;

  const credits: CreditItem[] = [];
  const addCredits = (
    ids: string[],
    role: CreditItem["role"],
    billingStart = 0,
  ) => {
    ids.forEach((id, index) => {
      credits.push({
        name: label(id),
        role,
        billingOrder: billingStart + index,
        providerId: id,
      });
    });
  };
  addCredits(claimEntityIds(entity, "P57"), "director");
  addCredits(claimEntityIds(entity, "P58"), "writer");
  addCredits(claimEntityIds(entity, "P170"), "creator");
  addCredits(claimEntityIds(entity, "P161"), "actor");
  addCredits(claimEntityIds(entity, "P86"), "composer");

  const releaseDates = claimTimes(entity, "P577")
    .map(formatWikidataTime)
    .filter((value): value is string => Boolean(value))
    .sort();
  const startTimes = claimTimes(entity, "P580")
    .map(formatWikidataTime)
    .filter((value): value is string => Boolean(value))
    .sort();
  const endTimes = claimTimes(entity, "P582")
    .map(formatWikidataTime)
    .filter((value): value is string => Boolean(value))
    .sort();

  const releaseDate =
    kind === "series"
      ? (startTimes[0] ?? releaseDates[0] ?? null)
      : (releaseDates[0] ?? null);

  const runtimeValues = claimQuantities(entity, "P2047");
  const seasonCount = claimQuantities(entity, "P2437")[0] ?? null;
  const episodeCount = claimQuantities(entity, "P1113")[0] ?? null;

  // Etiket yoksa QID'ye dusulmez; oncelik sirasi:
  //   en etiketi -> istenen dil etiketi -> enwiki/trwiki sitelink basligi
  //   -> en az bir dildeki etiket -> QID
  // (Bazi kayitlarda yalnizca Cinca etiket vardir; sitelink basligi dogru adi
  //  vermek, yabanci bir adi gostermekten iyidir.)
  const firstAvailableLabel = Object.values(entity.labels ?? {}).find(
    (entry) => typeof entry?.value === "string" && entry.value.length > 0,
  );
  const enSitelinkTitle = entity.sitelinks?.enwiki?.title ?? null;
  const localSitelinkTitle =
    entity.sitelinks?.[language === "tr" ? "trwiki" : "enwiki"]?.title ?? null;

  const originalTitle =
    entity.labels?.en?.value ??
    entity.labels?.[language]?.value ??
    enSitelinkTitle ??
    localSitelinkTitle ??
    firstAvailableLabel?.value ??
    qid;
  const localizedTitle =
    entity.labels?.[language]?.value ??
    (language === "tr" ? localSitelinkTitle : null);
  const description =
    entity.descriptions?.[language]?.value ??
    entity.descriptions?.en?.value ??
    null;

  const tmdbMovieId = claimStrings(entity, "P4947")[0] ?? null;
  const tmdbTvId = claimStrings(entity, "P4983")[0] ?? null;
  const imdbId = claimStrings(entity, "P345")[0] ?? null;
  const officialSite = claimStrings(entity, "P856")[0] ?? null;

  const sitelink =
    entity.sitelinks?.[language === "tr" ? "trwiki" : "enwiki"] ??
    entity.sitelinks?.enwiki ??
    null;
  const sourceUrl = sitelink
    ? `https://${language === "tr" ? "tr" : "en"}.wikipedia.org/wiki/${encodeURIComponent(
        sitelink.title.replace(/ /g, "_"),
      )}`
    : `https://www.wikidata.org/wiki/${qid}`;

  const verifiedFields: string[] = ["originalTitle", "wikidataId"];
  if (releaseDate) verifiedFields.push("releaseDate");
  if (description) verifiedFields.push("overview");
  if (genreIds.length) verifiedFields.push("genres");
  if (credits.length) verifiedFields.push("credits");
  if (runtimeValues.length) verifiedFields.push("runtimeMinutes");
  if (officialSite) verifiedFields.push("homepageUrl");
  if (imdbId) verifiedFields.push("imdbId");

  const seasons: SeasonSummary[] =
    kind === "series" && seasonCount
      ? Array.from({ length: Math.min(seasonCount, 50) }, (_, index) => ({
          providerId: `${qid}-s${index + 1}`,
          seasonNumber: index + 1,
          name: null,
          episodeCount: null,
          premiereDate: null,
          endDate: null,
          posterUrl: null,
        }))
      : [];

  return {
    provider: "wikidata",
    providerId: qid,
    kind,
    originalTitle,
    localizedTitle:
      localizedTitle && localizedTitle !== originalTitle ? localizedTitle : null,
    originalLanguage:
      languageIds.length > 0 ? label(languageIds[0]) : null,
    overview: description,
    releaseDate,
    releaseYear: yearFromDate(releaseDate ?? undefined),
    endDate: endTimes[0] ?? null,
    runtimeMinutes: runtimeValues[0] ?? null,
    posterUrl: null,
    backdropUrl: null,
    homepageUrl: officialSite,
    imdbId,
    wikidataId: qid,
    tmdbId: tmdbMovieId ?? tmdbTvId,
    tvmazeId: null,
    genres: genreIds.map(label),
    countries: countryIds.map(localLabel),
    languages: languageIds.map(localLabel),
    credits,
    aliases: [],
    seasons,
    externalRating: null,
    externalRatingCount: episodeCount ? null : null,
    externalRatingSource: null,
    sourceUrl,
    verifiedFields,
  };
}

/* -------------------------------------------------------------------------- */
/* Wikipedia ozeti                                                            */
/* -------------------------------------------------------------------------- */

type WikipediaSummary = {
  title?: string;
  extract?: string;
  description?: string;
  content_urls?: { desktop?: { page?: string } };
  thumbnail?: { source?: string };
  type?: string;
};

/**
 * Wikipedia REST ozeti. Wikidata'da aciklama yoksa konu ozeti icin kullanilir.
 * Telif: yalnizca kisa ozet + kaynak baglantisi gosterilir (CC BY-SA).
 */
export async function getWikipediaSummary(
  title: string,
  language: "tr" | "en",
): Promise<{
  title: string;
  extract: string;
  url: string;
  description: string | null;
  imageUrl: string | null;
} | null> {
  const url = `https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
    title.replace(/ /g, "_"),
  )}?redirect=true`;

  try {
    const { data } = await providerFetchJson<WikipediaSummary>({
      provider: "wikipedia",
      url,
      cacheTtlSeconds: 60 * 60 * 24 * 7,
    });
    if (!data.extract) return null;
    return {
      title: data.title ?? title,
      extract: data.extract,
      url:
        data.content_urls?.desktop?.page ??
        `https://${language}.wikipedia.org/wiki/${encodeURIComponent(title)}`,
      description: data.description ?? null,
      imageUrl: data.thumbnail?.source ?? null,
    };
  } catch {
    return null;
  }
}
