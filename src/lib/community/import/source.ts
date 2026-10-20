/**
 * Kisisel sinema hafizasi kaynak dosyalarinin ayristirilmasi — saf fonksiyonlar.
 *
 * Kaynaklar:
 *  - cinemaverse_personal_memory_import.json (yetkili kaynak)
 *  - cinemaverse_scored_titles.csv           (kontrol/aktarim dosyasi)
 *  - cinemaverse_watch_statuses.csv          (kontrol/aktarim dosyasi)
 *
 * Kurallar:
 *  - Ayni veri iki dosyada da varsa TEK kayit olusturulur (idempotency).
 *  - Kaynak dosyalar DEGISTIRILMEZ.
 *  - Bilinmeyen degerler null/unknown olarak korunur; hicbir deger uydurulmaz.
 */

/* -------------------------------------------------------------------------- */
/* Tipler                                                                     */
/* -------------------------------------------------------------------------- */

export type SourceStatus =
  | "watched"
  | "unwatched"
  | "partially_watched"
  | "watched_unrated"
  | "unknown";

export type SourceKind =
  | "film"
  | "series"
  | "miniseries"
  | "series_season"
  | "film_franchise"
  | "film_franchise_or_film"
  /** Kaynakta tur belirtilmemis (ornegin izlenmemis yapimlar listesi). */
  | "unknown";

export type SourceScope =
  | "single_film"
  | "overall_series"
  | "specific_season"
  | "overall_franchise"
  | "overall_trilogy"
  | "overall_scope_as_recorded"
  /** Kaynakta kapsam belirtilmemis. */
  | "unspecified";

export type MemoryRecord = {
  /** Idempotency anahtari: normalize baslik | yil | tur. */
  key: string;
  /** Kaynaktaki ham ad (aynen korunur). */
  rawTitle: string;
  /** "/" ile ayrilmis alternatif adlar (ornegin "The Revenant / Dirilis"). */
  altTitles: string[];
  year: number | null;
  kind: SourceKind;
  rating: number | null;
  scope: SourceScope;
  status: SourceStatus;
  notes: string;
  /** Kullanicinin acikca sevdigini belirttigi yapim. */
  explicitLike: boolean;
  /** Hangi kaynak dosyalarinda bu kayit goruldu. */
  seenIn: string[];
};

export type ParsedSources = {
  records: MemoryRecord[];
  /** JSON ve CSV arasindaki tutarsizliklar (raporlanir, duzeltilmez). */
  discrepancies: string[];
  explicitLikeTitles: string[];
  preferences: Record<string, unknown>;
  integrityRules: string[];
  stats: {
    jsonScored: number;
    jsonUnwatched: number;
    jsonPartially: number;
    jsonWatchedUnrated: number;
    jsonUnknown: number;
    csvScored: number;
    csvWatchStatuses: number;
    explicitLikes: number;
  };
};

/* -------------------------------------------------------------------------- */
/* Normalizasyon                                                              */
/* -------------------------------------------------------------------------- */

/** Turkce karakterleri sadelestirir, noktalama ve fazla bosluklari temizler. */
export function normalizeName(input: string): string {
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

/** Parantez icindeki ayirici ekleri temizler: "Shameless (US)" -> "shameless". */
export function stripParenQualifiers(input: string): string {
  return normalizeName(input.replace(/\((?:[^)]*)\)/g, " "));
}

/**
 * Kaynak adindaki alternatifleri ayirir: "A / B" -> ["A", "B"].
 * "/" icermeyen adlarda alternatif yoktur (bos liste doner).
 */
export function splitAltTitles(rawTitle: string): string[] {
  if (!rawTitle.includes("/")) return [];
  return rawTitle
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** Idempotency anahtari. */
export function recordKey(
  title: string,
  year: number | null,
  kind: SourceKind,
): string {
  return `${normalizeName(title)}|${year ?? "null"}|${kind}`;
}

/* -------------------------------------------------------------------------- */
/* CSV ayristirici                                                            */
/* -------------------------------------------------------------------------- */

/** RFC4180 uyumlu basit CSV ayristirici (tirnakli alanlar desteklenir). */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < input.length) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (char === "\r") {
      i += 1;
      continue;
    }
    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
      continue;
    }
    field += char;
    i += 1;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

/** CSV satirlarini sozluk dizisine cevirir. */
export function csvToObjects(input: string): Record<string, string>[] {
  const rows = parseCsv(input);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    header.forEach((key, index) => {
      obj[key] = (row[index] ?? "").trim();
    });
    return obj;
  });
}

/* -------------------------------------------------------------------------- */
/* Kayit uretimi                                                              */
/* -------------------------------------------------------------------------- */

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = String(value).trim();
  if (text.length === 0) return null;
  // "9,5" -> 9.5 ; "9.5" -> 9.5
  const normalized = text.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseYear(value: unknown): number | null {
  const parsed = parseNumber(value);
  if (parsed === null) return null;
  const year = Math.trunc(parsed);
  return year >= 1800 && year < 2200 ? year : null;
}

function makeRecord(input: {
  rawTitle: string;
  year: number | null;
  kind: SourceKind;
  rating: number | null;
  scope: SourceScope;
  status: SourceStatus;
  notes: string;
  explicitLike: boolean;
  source: string;
}): MemoryRecord {
  return {
    key: recordKey(input.rawTitle, input.year, input.kind),
    rawTitle: input.rawTitle,
    altTitles: splitAltTitles(input.rawTitle),
    year: input.year,
    kind: input.kind,
    rating: input.rating,
    scope: input.scope,
    status: input.status,
    notes: input.notes,
    explicitLike: input.explicitLike,
    seenIn: [input.source],
  };
}

/* -------------------------------------------------------------------------- */
/* JSON ayristirma                                                            */
/* -------------------------------------------------------------------------- */

type JsonRecord = {
  title?: unknown;
  year?: unknown;
  kind?: unknown;
  rating?: unknown;
  rating_scope?: unknown;
  status?: unknown;
  notes?: unknown;
};

const KINDS: SourceKind[] = [
  "film",
  "series",
  "miniseries",
  "series_season",
  "film_franchise",
  "film_franchise_or_film",
  "unknown",
];

const SCOPES: SourceScope[] = [
  "single_film",
  "overall_series",
  "specific_season",
  "overall_franchise",
  "overall_trilogy",
  "overall_scope_as_recorded",
  "unspecified",
];

const STATUSES: SourceStatus[] = [
  "watched",
  "unwatched",
  "partially_watched",
  "watched_unrated",
  "unknown",
];

function asKind(value: unknown): SourceKind {
  return typeof value === "string" && (KINDS as string[]).includes(value)
    ? (value as SourceKind)
    : "unknown";
}

function asScope(value: unknown): SourceScope {
  return typeof value === "string" && (SCOPES as string[]).includes(value)
    ? (value as SourceScope)
    : "unspecified";
}

function asStatus(value: unknown): SourceStatus {
  return typeof value === "string" && (STATUSES as string[]).includes(value)
    ? (value as SourceStatus)
    : "unknown";
}

export function parseJsonSource(raw: string): {
  records: MemoryRecord[];
  explicitLikeTitles: string[];
  preferences: Record<string, unknown>;
  integrityRules: string[];
  stats: ParsedSources["stats"];
} {
  const data = JSON.parse(raw) as {
    scored_titles?: JsonRecord[];
    explicit_likes_without_extra_rating_implications?: string[];
    unwatched_titles?: JsonRecord[];
    partially_watched_titles?: JsonRecord[];
    watched_unrated_titles?: JsonRecord[];
    uncertain_status_titles?: JsonRecord[];
    preferences_and_rules?: Record<string, unknown>;
    data_integrity_rules?: string[];
  };

  const records: MemoryRecord[] = [];
  const explicitLikeTitles = (
    data.explicit_likes_without_extra_rating_implications ?? []
  ).filter((value): value is string => typeof value === "string");

  const scored = data.scored_titles ?? [];
  for (const item of scored) {
    const rawTitle = typeof item.title === "string" ? item.title.trim() : "";
    if (!rawTitle) continue;
    records.push(
      makeRecord({
        rawTitle,
        year: parseYear(item.year),
        kind: asKind(item.kind),
        rating: parseNumber(item.rating),
        scope: asScope(item.rating_scope),
        status: asStatus(item.status),
        notes: typeof item.notes === "string" ? item.notes : "",
        explicitLike: false,
        source: "json:scored_titles",
      }),
    );
  }

  const pushSimple = (
    list: JsonRecord[] | undefined,
    kind: SourceKind,
    scope: SourceScope,
    source: string,
  ) => {
    for (const item of list ?? []) {
      const rawTitle = typeof item.title === "string" ? item.title.trim() : "";
      if (!rawTitle) continue;
      records.push(
        makeRecord({
          rawTitle,
          year: parseYear(item.year),
          kind,
          rating: parseNumber(item.rating),
          scope,
          status: asStatus(item.status),
          notes: typeof item.notes === "string" ? item.notes : "",
          explicitLike: false,
          source,
        }),
      );
    }
  };

  // Bu bölümdeki kaynaklarda tur/kapsam BILINMIYOR; uydurulmaz.
  pushSimple(data.unwatched_titles, "unknown", "unspecified", "json:unwatched_titles");
  pushSimple(
    data.partially_watched_titles,
    "unknown",
    "unspecified",
    "json:partially_watched_titles",
  );
  pushSimple(
    data.watched_unrated_titles,
    "unknown",
    "unspecified",
    "json:watched_unrated_titles",
  );
  pushSimple(
    data.uncertain_status_titles,
    "unknown",
    "unspecified",
    "json:uncertain_status_titles",
  );

  return {
    records,
    explicitLikeTitles,
    preferences: data.preferences_and_rules ?? {},
    integrityRules: data.data_integrity_rules ?? [],
    stats: {
      jsonScored: scored.length,
      jsonUnwatched: (data.unwatched_titles ?? []).length,
      jsonPartially: (data.partially_watched_titles ?? []).length,
      jsonWatchedUnrated: (data.watched_unrated_titles ?? []).length,
      jsonUnknown: (data.uncertain_status_titles ?? []).length,
      csvScored: 0,
      csvWatchStatuses: 0,
      explicitLikes: explicitLikeTitles.length,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* CSV ayristirma                                                             */
/* -------------------------------------------------------------------------- */

export function parseCsvSources(
  scoredCsv: string,
  statusesCsv: string,
): {
  records: MemoryRecord[];
  discrepancies: string[];
  stats: { csvScored: number; csvWatchStatuses: number };
} {
  const discrepancies: string[] = [];
  const records: MemoryRecord[] = [];

  const scoredRows = csvToObjects(scoredCsv);
  for (const row of scoredRows) {
    const rawTitle = (row.title ?? "").trim();
    if (!rawTitle) continue;
    records.push(
      makeRecord({
        rawTitle,
        year: parseYear(row.year),
        kind: asKind(row.kind),
        rating: parseNumber(row.rating),
        scope: asScope(row.rating_scope),
        status: asStatus(row.status),
        notes: row.notes ?? "",
        explicitLike: false,
        source: "csv:scored_titles",
      }),
    );
  }

  const statusRows = csvToObjects(statusesCsv);
  for (const row of statusRows) {
    const rawTitle = (row.title ?? "").trim();
    if (!rawTitle) continue;
    const status = asStatus(row.status);
    // CSV izleme-durumu dosyasinda yil ve tur YOKTUR; uydurulmaz.
    records.push(
      makeRecord({
        rawTitle,
        year: null,
        kind: "unknown",
        rating: parseNumber(row.rating),
        scope: "unspecified",
        status,
        notes: row.notes ?? "",
        explicitLike: false,
        source: "csv:watch_statuses",
      }),
    );
  }

  return {
    records,
    discrepancies,
    stats: {
      csvScored: scoredRows.length,
      csvWatchStatuses: statusRows.length,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Birlestirme                                                                */
/* -------------------------------------------------------------------------- */

/**
 * JSON ve CSV kayitlarini birlestirir. Ayni idempotency anahtari olan
 * kayitlar TEK kayda indirgenir; kaynak dosyalar listelenir.
 */
export function mergeRecords(
  jsonRecords: MemoryRecord[],
  csvRecords: MemoryRecord[],
): { records: MemoryRecord[]; discrepancies: string[] } {
  const discrepancies: string[] = [];
  const byKey = new Map<string, MemoryRecord>();
  /** Ayni ad + ayni tur, farkli yil: yil uyumlu olanlar birlestirilir. */
  const byNameKind = new Map<string, MemoryRecord[]>();

  const nameKindKey = (record: MemoryRecord) =>
    `${normalizeName(record.rawTitle)}|${record.kind}`;

  const add = (record: MemoryRecord) => {
    let existing = byKey.get(record.key);

    if (!existing) {
      // Yil farki olan ayni ad+tur kayitlari: yil uyumlu tek karsilik varsa birlestir.
      const group = byNameKind.get(nameKindKey(record)) ?? [];
      const compatible = group.filter(
        (candidate) =>
          record.year === null ||
          candidate.year === null ||
          Math.abs(candidate.year - record.year) <= 1,
      );
      if (compatible.length === 1) {
        existing = compatible[0];
        byKey.set(existing.key, existing);
      } else if (compatible.length > 1) {
        discrepancies.push(
          `Yil belirsiz eslesme: "${record.rawTitle}" (${record.year ?? "?"}) — ${compatible.length} aday`,
        );
      }
    }

    if (!existing) {
      byKey.set(record.key, { ...record, seenIn: [...record.seenIn] });
      const group = byNameKind.get(nameKindKey(record)) ?? [];
      group.push(byKey.get(record.key)!);
      byNameKind.set(nameKindKey(record), group);
      return;
    }

    // Ayni kayit iki dosyada da var: tek kayit tutulur.
    for (const source of record.seenIn) {
      if (!existing.seenIn.includes(source)) existing.seenIn.push(source);
    }
    // JSON yetkili kaynak: eksik alanlar JSON'dan tamamlanir.
    if (existing.rating === null && record.rating !== null) {
      existing.rating = record.rating;
    }
    if (existing.year === null && record.year !== null) {
      existing.year = record.year;
    }
    if (existing.notes.length === 0 && record.notes.length > 0) {
      existing.notes = record.notes;
    }
    if (record.explicitLike) existing.explicitLike = true;

    // Cakisan farkli degerler tespit edilir (raporlanir, sessizce ezilmez).
    if (
      record.rating !== null &&
      existing.rating !== null &&
      record.rating !== existing.rating
    ) {
      discrepancies.push(
        `Puan farki: "${existing.rawTitle}" JSON=${existing.rating} CSV=${record.rating}`,
      );
    }
    if (record.status !== existing.status) {
      discrepancies.push(
        `Durum farki: "${existing.rawTitle}" JSON=${existing.status} CSV=${record.status}`,
      );
    }
  };

  for (const record of jsonRecords) add(record);
  for (const record of csvRecords) add(record);

  return { records: [...byKey.values()], discrepancies };
}

/**
 * "Sevilenler" listesini kayitlara baglar. Once tam normalize eslesme,
 * sonra tek aday varsa parantez temizlenmis eslesme denenir.
 */
export function applyExplicitLikes(
  records: MemoryRecord[],
  likeTitles: string[],
): { records: MemoryRecord[]; unmatched: string[] } {
  const unmatched: string[] = [];
  const byFull = new Map<string, MemoryRecord[]>();
  const byLoose = new Map<string, MemoryRecord[]>();

  for (const record of records) {
    // Ayni normalize ad birden fazla kayda baglanmamali (mukerrer sayimi onler).
    const names = new Set<string>([record.rawTitle, ...record.altTitles]);
    for (const name of names) {
      const full = normalizeName(name);
      byFull.set(full, [...(byFull.get(full) ?? []), record]);
      const loose = stripParenQualifiers(name);
      byLoose.set(loose, [...(byLoose.get(loose) ?? []), record]);
    }
  }

  const result = records.map((record) => ({ ...record }));
  const byKey = new Map(result.map((record) => [record.key, record]));

  for (const likeTitle of likeTitles) {
    const full = normalizeName(likeTitle);
    const loose = stripParenQualifiers(likeTitle);

    const exact = byFull.get(full) ?? [];
    let matched: MemoryRecord | undefined;

    if (exact.length === 1) {
      matched = exact[0];
    } else if (exact.length > 1) {
      unmatched.push(`${likeTitle} (birden fazla tam eslesme)`);
      continue;
    } else {
      const looseMatches = byLoose.get(loose) ?? [];
      if (looseMatches.length === 1) {
        matched = looseMatches[0];
      } else if (looseMatches.length > 1) {
        unmatched.push(`${likeTitle} (birden fazla gevsek eslesme)`);
        continue;
      }
    }

    if (!matched) {
      unmatched.push(likeTitle);
      continue;
    }
    const target = byKey.get(matched.key);
    if (target) target.explicitLike = true;
  }

  return { records: result, unmatched };
}

/* -------------------------------------------------------------------------- */
/* Puan dagilimi                                                               */
/* -------------------------------------------------------------------------- */

export function ratingDistribution(
  records: MemoryRecord[],
): Map<number, number> {
  const distribution = new Map<number, number>();
  for (const record of records) {
    if (record.rating === null) continue;
    distribution.set(record.rating, (distribution.get(record.rating) ?? 0) + 1);
  }
  return distribution;
}

export function averageRating(records: MemoryRecord[]): number | null {
  const rated = records.filter((r) => r.rating !== null);
  if (rated.length === 0) return null;
  const sum = rated.reduce((total, r) => total + (r.rating as number), 0);
  return sum / rated.length;
}
