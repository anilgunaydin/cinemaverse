import { describe, expect, it } from "vitest";

import { csvToObjects, parseCsv, toCsv } from "@/lib/data/csv";
import { buildTitleIndex, resolveTitleId, type TitleIndexEntry } from "@/lib/data/matching";
import type { ExportLibraryEntry } from "@/lib/data/types";

function indexEntry(overrides: Partial<TitleIndexEntry> = {}): TitleIndexEntry {
  return {
    id: "ttl_1",
    originalTitle: "Inception",
    localizedTitle: "Başlangıç",
    releaseYear: 2010,
    kind: "movie",
    imdbId: "tt1375666",
    tmdbId: "27205",
    tvmazeId: null,
    wikidataId: "Q25188",
    ...overrides,
  };
}

function exportEntry(overrides: Partial<ExportLibraryEntry> = {}): ExportLibraryEntry {
  return {
    imdbId: null,
    tmdbId: null,
    tvmazeId: null,
    wikidataId: null,
    titleName: "Inception",
    releaseYear: 2010,
    kind: "movie",
    status: "watched",
    rating: 9,
    watchedAt: null,
    watchedPeriod: null,
    notes: null,
    likedAspects: null,
    dislikedAspects: null,
    memorableScenes: null,
    rewatchIntent: null,
    progressSeason: null,
    progressEpisode: null,
    isFavorite: false,
    ...overrides,
  };
}

describe("csv", () => {
  it("virgul ve tirnak iceren hucreleri kacirir", () => {
    const csv = toCsv([{ a: 'değer, "önemli"', b: 5 }]);
    expect(csv).toContain('"değer, ""önemli"""');
    expect(csv).toContain("5");
  });

  it("gidis-donus ayni veriyi korur", () => {
    const rows = [
      { title: "Inception", year: "2010", note: "a,b\nc" },
      { title: 'Film "X"', year: "2021", note: "" },
    ];
    const csv = toCsv(rows);
    const parsed = csvToObjects(csv);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual(rows[0]);
    expect(parsed[1].title).toBe('Film "X"');
  });

  it("BOM ve CRLF ile ayristirir", () => {
    const text = "\uFEFFa,b\r\n1,2\r\n3,4\r\n";
    expect(parseCsv(text)).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });
});

describe("resolveTitleId", () => {
  const index = buildTitleIndex([
    indexEntry(),
    indexEntry({
      id: "ttl_2",
      originalTitle: "Breaking Bad",
      localizedTitle: null,
      releaseYear: 2008,
      kind: "series",
      imdbId: "tt0903747",
      tmdbId: "1396",
      tvmazeId: "169",
      wikidataId: "Q1079",
    }),
  ]);

  it("harici IMDb kimligi ile eslestirir", () => {
    expect(resolveTitleId(exportEntry({ imdbId: "tt1375666" }), index)).toEqual({
      titleId: "ttl_1",
      method: "imdb",
    });
  });

  it("TVmaze kimligi ile dizi eslestirir", () => {
    expect(resolveTitleId(exportEntry({ tvmazeId: "169", kind: "series" }), index)).toEqual({
      titleId: "ttl_2",
      method: "tvmaze",
    });
  });

  it("isim + yil ile eslestirir", () => {
    expect(resolveTitleId(exportEntry({ titleName: "Inception" }), index)).toEqual({
      titleId: "ttl_1",
      method: "name_year",
    });
  });

  it("yerel baslikla eslestirir", () => {
    expect(resolveTitleId(exportEntry({ titleName: "Başlangıç" }), index)).toEqual({
      titleId: "ttl_1",
      method: "name_year",
    });
  });

  it("kucuk yazim farkinda bulanik eslesir", () => {
    expect(
      resolveTitleId(exportEntry({ titleName: "inceptiom", releaseYear: 2010 }), index).method,
    ).toBe("fuzzy");
  });

  it("katalogda olmayan yapim icin null dondurur", () => {
    const result = resolveTitleId(
      exportEntry({ titleName: "Tamamen Bilinmeyen Film", releaseYear: 1999 }),
      index,
    );
    expect(result.titleId).toBeNull();
    expect(result.method).toBe("none");
  });
});
