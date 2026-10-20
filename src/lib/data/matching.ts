/**
 * Ice aktarilan kayitlari katalogdaki yapimlarla eslestirme (saf fonksiyonlar).
 *
 * Kural: eslestirme YALNIZCA var olan katalog kayitlariyla yapilir. Eslesme
 * bulunamazsa kayit ice aktarilmaz ve "eslesmedi" olarak raporlanir; boylece
 * hayali/kaynak dogrulamasi olmayan katalog kaydi olusturulmaz.
 */

import { normalizeTitle, similarity } from "@/lib/catalog/matching";
import type { ExportLibraryEntry } from "./types";

export type TitleIndexEntry = {
  id: string;
  originalTitle: string;
  localizedTitle: string | null;
  releaseYear: number | null;
  kind: string;
  imdbId: string | null;
  tmdbId: string | null;
  tvmazeId: string | null;
  wikidataId: string | null;
};

export type TitleIndex = {
  entries: TitleIndexEntry[];
  byImdb: Map<string, string>;
  byTmdb: Map<string, string>;
  byTvmaze: Map<string, string>;
  byWikidata: Map<string, string>;
  byNameYear: Map<string, string>;
  byName: Map<string, string>;
};

function setIfAbsent(map: Map<string, string>, key: string, id: string) {
  if (!key) return;
  if (!map.has(key)) map.set(key, id);
}

export function buildTitleIndex(entries: TitleIndexEntry[]): TitleIndex {
  const index: TitleIndex = {
    entries,
    byImdb: new Map(),
    byTmdb: new Map(),
    byTvmaze: new Map(),
    byWikidata: new Map(),
    byNameYear: new Map(),
    byName: new Map(),
  };

  const nameCounts = new Map<string, number>();

  for (const entry of entries) {
    if (entry.imdbId) setIfAbsent(index.byImdb, entry.imdbId, entry.id);
    if (entry.tmdbId) setIfAbsent(index.byTmdb, entry.tmdbId, entry.id);
    if (entry.tvmazeId) setIfAbsent(index.byTvmaze, entry.tvmazeId, entry.id);
    if (entry.wikidataId) setIfAbsent(index.byWikidata, entry.wikidataId, entry.id);

    const names = [entry.originalTitle, entry.localizedTitle].filter(
      (value): value is string => Boolean(value),
    );
    for (const name of names) {
      const normalized = normalizeTitle(name);
      if (!normalized) continue;
      if (entry.releaseYear) {
        setIfAbsent(index.byNameYear, `${normalized}|${entry.releaseYear}`, entry.id);
      }
      nameCounts.set(normalized, (nameCounts.get(normalized) ?? 0) + 1);
    }
  }

  // Yalnizca tek bir yapima karsilik gelen isimleri guvenli kabul et.
  for (const entry of entries) {
    const names = [entry.originalTitle, entry.localizedTitle].filter(
      (value): value is string => Boolean(value),
    );
    for (const name of names) {
      const normalized = normalizeTitle(name);
      if (normalized && nameCounts.get(normalized) === 1) {
        setIfAbsent(index.byName, normalized, entry.id);
      }
    }
  }

  return index;
}

export type ResolveMethod =
  | "imdb"
  | "tmdb"
  | "tvmaze"
  | "wikidata"
  | "name_year"
  | "name"
  | "fuzzy"
  | "none";

export function resolveTitleId(
  entry: ExportLibraryEntry,
  index: TitleIndex,
): { titleId: string | null; method: ResolveMethod } {
  if (entry.imdbId && index.byImdb.has(entry.imdbId)) {
    return { titleId: index.byImdb.get(entry.imdbId)!, method: "imdb" };
  }
  if (entry.tmdbId && index.byTmdb.has(entry.tmdbId)) {
    return { titleId: index.byTmdb.get(entry.tmdbId)!, method: "tmdb" };
  }
  if (entry.tvmazeId && index.byTvmaze.has(entry.tvmazeId)) {
    return { titleId: index.byTvmaze.get(entry.tvmazeId)!, method: "tvmaze" };
  }
  if (entry.wikidataId && index.byWikidata.has(entry.wikidataId)) {
    return { titleId: index.byWikidata.get(entry.wikidataId)!, method: "wikidata" };
  }

  const normalized = normalizeTitle(entry.titleName);
  if (!normalized) return { titleId: null, method: "none" };

  if (entry.releaseYear) {
    const key = `${normalized}|${entry.releaseYear}`;
    if (index.byNameYear.has(key)) {
      return { titleId: index.byNameYear.get(key)!, method: "name_year" };
    }
  }

  if (index.byName.has(normalized)) {
    return { titleId: index.byName.get(normalized)!, method: "name" };
  }

  // Bulanik eslesme: yalnizca yuksek benzerlikte ve yil uyumlu.
  let best: { id: string; score: number } | null = null;
  for (const candidate of index.entries) {
    if (entry.kind && candidate.kind && entry.kind !== candidate.kind) continue;
    if (
      entry.releaseYear &&
      candidate.releaseYear &&
      Math.abs(entry.releaseYear - candidate.releaseYear) > 1
    ) {
      continue;
    }
    const names = [candidate.originalTitle, candidate.localizedTitle].filter(
      (value): value is string => Boolean(value),
    );
    const score = names.reduce(
      (max, name) => Math.max(max, similarity(entry.titleName, name)),
      0,
    );
    if (score >= 0.85 && (!best || score > best.score)) {
      best = { id: candidate.id, score };
    }
  }

  if (best) return { titleId: best.id, method: "fuzzy" };
  return { titleId: null, method: "none" };
}
