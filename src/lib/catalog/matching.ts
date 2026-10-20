/**
 * Baslik eslestirme ve mukerrer kayit kontrolu icin saf (pure) fonksiyonlar.
 * Veritabani veya ag erisimi yoktur; birim testleri kolaydir.
 */

/** Turkce karakterleri sadelestirir, noktalama ve fazla bosluklari temizler. */
export function normalizeTitle(input: string): string {
  return input
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/â/g, "a")
    .replace(/î/g, "i")
    .replace(/û/g, "u")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Yapim turu eklerini ayiklar: "Inception (2010)" -> "inception". */
export function stripReleaseSuffix(input: string): string {
  return input
    .replace(/\((?:19|20)\d{2}\)/g, " ")
    .replace(/\b(?:19|20)\d{2}\b\s*$/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Levenshtein mesafesi (kucuk metinler icin yeterli). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = new Array<number>(b.length + 1);
  let current = new Array<number>(b.length + 1);

  for (let j = 0; j <= b.length; j += 1) previous[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost,
      );
    }
    [previous, current] = [current, previous];
  }

  return previous[b.length];
}

/** 0..1 arasi benzerlik. */
export function similarity(a: string, b: string): number {
  const left = normalizeTitle(a);
  const right = normalizeTitle(b);
  if (!left && !right) return 1;
  if (!left || !right) return 0;
  if (left === right) return 1;
  const distance = levenshtein(left, right);
  return 1 - distance / Math.max(left.length, right.length);
}

export type MatchCandidate = {
  originalTitle: string;
  localizedTitle?: string | null;
  releaseYear?: number | null;
  kind?: string | null;
  imdbId?: string | null;
  tmdbId?: string | null;
  tvmazeId?: string | null;
  wikidataId?: string | null;
};

/**
 * Arama sonucu ile aday yapimin eslesme skoru (0..1).
 * Yil farki ve tur uyusmazligi skoru dusurur.
 */
export function scoreMatch(
  query: string,
  candidate: MatchCandidate,
  expectedYear?: number | null,
  expectedKind?: string | null,
): number {
  const cleanedQuery = stripReleaseSuffix(query);

  const names = [candidate.originalTitle, candidate.localizedTitle].filter(
    (value): value is string => Boolean(value),
  );
  const nameScore = names.reduce(
    (best, name) =>
      Math.max(best, similarity(cleanedQuery, stripReleaseSuffix(name))),
    0,
  );

  let score = nameScore;

  if (expectedYear && candidate.releaseYear) {
    const diff = Math.abs(expectedYear - candidate.releaseYear);
    if (diff === 0) score += 0.15;
    else if (diff === 1) score += 0.05;
    else if (diff >= 3) score -= 0.3;
    else score -= 0.1;
  }

  if (expectedKind && candidate.kind && expectedKind !== candidate.kind) {
    // film <-> dizi karisikligi ciddi bir hatadir.
    const movieLike = new Set(["movie", "film"]);
    const seriesLike = new Set(["series", "tv", "show"]);
    const bothMovie = movieLike.has(expectedKind) && movieLike.has(candidate.kind);
    const bothSeries = seriesLike.has(expectedKind) && seriesLike.has(candidate.kind);
    if (!bothMovie && !bothSeries) score -= 0.35;
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Mukerrer kayit anahtari. Harici kimlik varsa o kullanilir; yoksa
 * normalize edilmis baslik + yil + tur.
 */
export function dedupeKey(input: MatchCandidate): string {
  if (input.imdbId) return `imdb:${input.imdbId}`;
  if (input.tmdbId) return `tmdb:${input.tmdbId}`;
  if (input.tvmazeId) return `tvmaze:${input.tvmazeId}`;
  if (input.wikidataId) return `wikidata:${input.wikidataId}`;
  const year = input.releaseYear ?? "unknown";
  const kind = input.kind ?? "unknown";
  return `name:${normalizeTitle(input.originalTitle)}|${year}|${kind}`;
}

/** Bir yapimin diger adayla ayni olup olmadigina karar verir. */
export function isSameTitle(
  a: MatchCandidate,
  b: MatchCandidate,
  threshold = 0.92,
): boolean {
  const identityKeys = [
    ["imdbId", a.imdbId, b.imdbId],
    ["tmdbId", a.tmdbId, b.tmdbId],
    ["tvmazeId", a.tvmazeId, b.tvmazeId],
    ["wikidataId", a.wikidataId, b.wikidataId],
  ] as const;

  for (const [, left, right] of identityKeys) {
    if (left && right && left === right) return true;
  }

  if (a.kind && b.kind && a.kind !== b.kind) return false;

  const nameScore = Math.max(
    similarity(a.originalTitle, b.originalTitle),
    a.localizedTitle && b.localizedTitle
      ? similarity(a.localizedTitle, b.localizedTitle)
      : 0,
    a.localizedTitle ? similarity(a.localizedTitle, b.originalTitle) : 0,
    b.localizedTitle ? similarity(b.localizedTitle, a.originalTitle) : 0,
  );

  if (nameScore < threshold) return false;

  // Ayni isim, farkli yil: yeniden cevrim veya devam filmi olabilir.
  if (a.releaseYear && b.releaseYear) {
    return Math.abs(a.releaseYear - b.releaseYear) <= 1;
  }

  return true;
}
