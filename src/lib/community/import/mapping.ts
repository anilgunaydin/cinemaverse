/**
 * Kaynak alanlarinin uygulama modeline eslestirilmesi — saf fonksiyonlar.
 *
 * Kaynak durum/tur/kapsam degerleri uygulamadaki en yakin karsiliga
 * donusturulur. Esleme yapilamayan her deger acikca raporlanir; hicbir
 * deger "tahmin" edilerek degistirilmez.
 */

import type { WatchStatus } from "@/lib/db/schema";
import type {
  MemoryRecord,
  SourceKind,
  SourceScope,
  SourceStatus,
} from "@/lib/community/import/source";

export type TitleKind =
  | "movie"
  | "series"
  | "season"
  | "episode"
  | "franchise"
  /** Kaynakta tur bilinmiyor; eslestirme her iki turde yapilir. */
  | "unknown";

/**
 * Kaynak izleme durumu -> uygulama watch status.
 *
 * watched            -> watched
 * unwatched          -> not_watched
 * partially_watched  -> watching   (yarim birakildi / tamamlanmadi)
 * watched_unrated    -> watched     (izlendi, puan yok)
 * unknown            -> unsure      (durum belirsiz; izlenmis/izlenmemis varsayilmaz)
 */
export const STATUS_TO_WATCH_STATUS: Record<SourceStatus, WatchStatus> = {
  watched: "watched",
  unwatched: "not_watched",
  partially_watched: "watching",
  watched_unrated: "watched",
  unknown: "unsure",
};

export const STATUS_LABELS_TR: Record<SourceStatus, string> = {
  watched: "İzlenmiş",
  unwatched: "İzlenmemiş",
  partially_watched: "Yarım bırakılmış",
  watched_unrated: "İzlenmiş (puansız)",
  unknown: "Durum belirsiz",
};

/** Kaynak turu -> uygulama title kind. */
export const KIND_TO_TITLE_KIND: Record<SourceKind, TitleKind> = {
  film: "movie",
  series: "series",
  miniseries: "series",
  series_season: "season",
  film_franchise: "franchise",
  // Yil verildigi icin (2004) tekil film olarak ele alinir; kapsam degistirilmez.
  film_franchise_or_film: "movie",
  // Kaynakta tur yok: belirsiz, her iki turde aranir.
  unknown: "unknown",
};

/**
 * Puanin hangi kapsama ait oldugunu belirler.
 *
 * ONCELIK kaynak turunun kendisindedir: "The Hobbit" kaydi kind=film_franchise,
 * scope=overall_series olarak gelir; burada franchise kapsami korunur
 * (scope alani tekil filmi degil, film serisinin genelini anlatiyor).
 * Tur bilinmiyorsa scope'a bakilir.
 */
export function scopeToTitleKind(
  scope: SourceScope,
  fallbackKind: SourceKind,
): TitleKind {
  switch (fallbackKind) {
    case "film":
      return "movie";
    case "series":
    case "miniseries":
      return "series";
    case "series_season":
      return "season";
    case "film_franchise":
      return "franchise";
    // Yil verildigi icin (2004) tekil film olarak ele alinir.
    case "film_franchise_or_film":
      return "movie";
    case "unknown":
    default:
      break;
  }

  switch (scope) {
    case "single_film":
      return "movie";
    case "overall_series":
      return "series";
    case "specific_season":
      return "season";
    case "overall_franchise":
    case "overall_trilogy":
      return "franchise";
    case "overall_scope_as_recorded":
    case "unspecified":
    default:
      return "unknown";
  }
}

export function scopeLabelTr(scope: SourceScope): string {
  switch (scope) {
    case "single_film":
      return "Tekil film";
    case "overall_series":
      return "Dizi geneli";
    case "specific_season":
      return "Belirli sezon";
    case "overall_franchise":
      return "Franchise geneli";
    case "overall_trilogy":
      return "Üçleme geneli";
    case "overall_scope_as_recorded":
      return "Kayıttaki kapsam";
    case "unspecified":
      return "Belirtilmemiş";
    default:
      return scope;
  }
}

/**
 * Bir kaydin hedeflenen title turunu ve izleme durumunu dondurur.
 * Puan kapsami ile tur uyumsuzsa (ornegin franchise puani bir diziye
 * yazilamaz) kayit "kapsam uyumsuz" olarak isaretlenir.
 */
export function resolveTarget(record: MemoryRecord): {
  titleKind: TitleKind;
  watchStatus: WatchStatus;
  scopeMismatch: boolean;
} {
  const watchStatus = STATUS_TO_WATCH_STATUS[record.status];
  const titleKind = scopeToTitleKind(record.scope, record.kind);
  const kindFromKind = KIND_TO_TITLE_KIND[record.kind];

  // Franchise puani asla tekil filmlere dagitilmaz; dizi puani sezona
  // kopyalanmaz. Kaynak kapsami ile turun uyumsuzlugu varsa isaretlenir.
  const scopeMismatch =
    (record.scope === "overall_franchise" || record.scope === "overall_trilogy") &&
    kindFromKind !== "franchise";

  return { titleKind, watchStatus, scopeMismatch };
}

/** Tercih kurallarini uygulamanin tercih profil JSON'una cevirir. */
export type PreferenceProfileJson = {
  source: string;
  importedAt: string;
  recommendationCourage: string;
  cultDiscovery: string;
  genres: string;
  coreTasteDimensions: string[];
  /** Motorun anlayacagi standart boyut adlari. */
  engineDimensions: string[];
  tempo: string;
  endings: string;
  characterPreferences: string;
  mysteryPreferences: string;
  storyComplexity: string;
  darknessAndViolence: string;
  spoilers: string;
  recommendationsOnlyOnRequest: boolean;
  doNotRecommendAlreadyWatched: boolean;
  recommendationOutputFields: string[];
  unknownDataPolicy: string;
  ratingScopePolicy: string;
  trueDetectiveS1LikedAspects: string[];
  trueDetectiveS1Limitation: string;
  language: string;
  projectName: string;
};

const PREFERENCE_DIMENSION_MAP: Record<string, string[]> = {
  "character development": ["characterDevelopment"],
  "screenplay and plot structure": ["screenplay", "plot"],
  "mystery and curiosity": ["mystery"],
};

export function buildPreferenceProfileJson(
  preferences: Record<string, unknown>,
  importedAt: string,
): PreferenceProfileJson {
  const coreTasteDimensions = Array.isArray(preferences.core_taste_dimensions)
    ? preferences.core_taste_dimensions.filter(
        (value): value is string => typeof value === "string",
      )
    : [];

  const engineDimensions = coreTasteDimensions.flatMap(
    (dimension) => PREFERENCE_DIMENSION_MAP[dimension.toLowerCase()] ?? [],
  );

  return {
    source: "cinemaverse_personal_memory_import.json",
    importedAt,
    recommendationCourage:
      typeof preferences.recommendation_courage === "string"
        ? preferences.recommendation_courage
        : "balanced",
    cultDiscovery:
      typeof preferences.cult_discovery === "string"
        ? preferences.cult_discovery
        : "some_room_for_cult_and_less_known_titles",
    genres:
      typeof preferences.genres === "string"
        ? preferences.genres
        : "all_genres_allowed",
    coreTasteDimensions,
    engineDimensions,
    tempo:
      typeof preferences.tempo === "string"
        ? preferences.tempo
        : "both slow/atmospheric and fast/plot-driven if well executed",
    endings:
      typeof preferences.endings === "string"
        ? preferences.endings
        : "all types acceptable if well written (twist, emotional, open-ended)",
    characterPreferences:
      typeof preferences.character_preferences === "string"
        ? preferences.character_preferences
        : "multiple types: transformation, strategy, psychology, relationships; do not infer a single dominant type",
    mysteryPreferences:
      typeof preferences.mystery_preferences === "string"
        ? preferences.mystery_preferences
        : "all types if well delivered",
    storyComplexity:
      typeof preferences.story_complexity === "string"
        ? preferences.story_complexity
        : "both layered/complex and clear/accessible if well written",
    darknessAndViolence:
      typeof preferences.darkness_and_violence === "string"
        ? preferences.darkness_and_violence
        : "should serve the story",
    spoilers:
      typeof preferences.spoilers === "string"
        ? preferences.spoilers
        : "none by default; explicit user permission required",
    recommendationsOnlyOnRequest:
      preferences.recommendations_only_on_request === true,
    doNotRecommendAlreadyWatched: preferences.do_not_recommend_already_watched === true,
    recommendationOutputFields: Array.isArray(
      preferences.recommendation_output_fields,
    )
      ? preferences.recommendation_output_fields.filter(
          (value): value is string => typeof value === "string",
        )
      : [
          "title",
          "genre",
          "why_it_may_fit",
          "discovery_level",
          "confidence_about_watched_status",
        ],
    unknownDataPolicy:
      typeof preferences.unknown_data_policy === "string"
        ? preferences.unknown_data_policy
        : "Never invent unknown ratings, watch statuses, dates, comments, or reasons for a score. Preserve null/unknown.",
    ratingScopePolicy:
      typeof preferences.rating_scope_policy === "string"
        ? preferences.rating_scope_policy
        : "TV series scores are overall series scores unless explicitly season-specific; franchises are overall franchise scores unless explicitly scoped; never distribute a franchise score to individual entries; distinct spin-offs remain separate.",
    trueDetectiveS1LikedAspects: Array.isArray(
      preferences.true_detective_s1_liked_aspects,
    )
      ? preferences.true_detective_s1_liked_aspects.filter(
          (value): value is string => typeof value === "string",
        )
      : [],
    trueDetectiveS1Limitation:
      typeof preferences.true_detective_s1_limitation === "string"
        ? preferences.true_detective_s1_limitation
        : "User does not remember why rating was not higher; do not invent a shortcoming.",
    language:
      typeof preferences.language === "string" ? preferences.language : "Turkish",
    projectName:
      typeof preferences.project_name === "string"
        ? preferences.project_name
        : "Kişisel Sinema Hafızası / CinemaVerse",
  };
}
