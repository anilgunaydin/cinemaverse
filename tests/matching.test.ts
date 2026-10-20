import { describe, expect, it } from "vitest";

import {
  dedupeKey,
  isSameTitle,
  normalizeTitle,
  scoreMatch,
  similarity,
  stripReleaseSuffix,
} from "@/lib/catalog/matching";

describe("normalizeTitle", () => {
  it("Turkce karakterleri sadelestirir", () => {
    expect(normalizeTitle("Başlangıç")).toBe("baslangic");
    expect(normalizeTitle("Kış Uykusu")).toBe("kis uykusu");
    expect(normalizeTitle("Ölümlü Dünya")).toBe("olumlu dunya");
  });

  it("noktalama ve fazla bosluklari temizler", () => {
    expect(normalizeTitle("  The   Dark Knight!  ")).toBe("the dark knight");
    expect(normalizeTitle("Fast & Furious")).toBe("fast and furious");
  });

  it("bos girdi icin bos dondurur", () => {
    expect(normalizeTitle("   ")).toBe("");
  });
});

describe("stripReleaseSuffix", () => {
  it("yil ekini kaldirir", () => {
    expect(stripReleaseSuffix("Inception (2010)")).toBe("Inception");
    expect(stripReleaseSuffix("Dune 2021")).toBe("Dune");
  });
});

describe("similarity", () => {
  it("ayni metin icin 1 dondurur", () => {
    expect(similarity("Inception", "inception")).toBe(1);
  });

  it("kucuk yazim farklarinda yuksek skor verir", () => {
    expect(similarity("Inception", "Incepton")).toBeGreaterThan(0.85);
  });

  it("tamamen farkli metinlerde dusuk skor verir", () => {
    expect(similarity("Inception", "Breaking Bad")).toBeLessThan(0.4);
  });
});

describe("scoreMatch", () => {
  it("tam eslesme ve dogru yil en yuksek skoru verir", () => {
    const score = scoreMatch("Inception", {
      originalTitle: "Inception",
      releaseYear: 2010,
      kind: "movie",
    }, 2010, "movie");
    expect(score).toBeGreaterThan(0.95);
  });

  it("film/dizi karisikligini cezalandirir", () => {
    const movieScore = scoreMatch("Breaking Bad", {
      originalTitle: "Breaking Bad",
      releaseYear: 2008,
      kind: "series",
    }, null, "movie");
    const seriesScore = scoreMatch("Breaking Bad", {
      originalTitle: "Breaking Bad",
      releaseYear: 2008,
      kind: "series",
    }, null, "series");
    expect(seriesScore).toBeGreaterThan(movieScore);
  });

  it("yil farki buyukse skoru dusurur", () => {
    const close = scoreMatch("Dune", { originalTitle: "Dune", releaseYear: 2021 }, 2021);
    const far = scoreMatch("Dune", { originalTitle: "Dune", releaseYear: 1984 }, 2021);
    expect(close).toBeGreaterThan(far);
  });
});

describe("dedupeKey", () => {
  it("harici kimlik varsa onu kullanir", () => {
    expect(dedupeKey({ originalTitle: "X", imdbId: "tt123" })).toBe("imdb:tt123");
    expect(dedupeKey({ originalTitle: "X", tmdbId: "550" })).toBe("tmdb:550");
  });

  it("kimlik yoksa isim + yil + tur kullanir", () => {
    expect(
      dedupeKey({ originalTitle: "Inception", releaseYear: 2010, kind: "movie" }),
    ).toBe("name:inception|2010|movie");
  });
});

describe("isSameTitle", () => {
  it("ayni IMDb kimligini ayni yapim sayar", () => {
    expect(
      isSameTitle(
        { originalTitle: "Inception", imdbId: "tt1375666", releaseYear: 2010 },
        { originalTitle: "Başlangıç", imdbId: "tt1375666", releaseYear: 2010 },
      ),
    ).toBe(true);
  });

  it("ayni isim farkli yil ise farkli yapim sayar (yeniden cevrim)", () => {
    expect(
      isSameTitle(
        { originalTitle: "Dune", releaseYear: 1984, kind: "movie" },
        { originalTitle: "Dune", releaseYear: 2021, kind: "movie" },
      ),
    ).toBe(false);
  });

  it("film ve dizi ayni isimde olsa farkli sayilir", () => {
    expect(
      isSameTitle(
        { originalTitle: "Fargo", releaseYear: 1996, kind: "movie" },
        { originalTitle: "Fargo", releaseYear: 2014, kind: "series" },
      ),
    ).toBe(false);
  });
});
