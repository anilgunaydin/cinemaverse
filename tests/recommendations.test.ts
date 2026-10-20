import { describe, expect, it } from "vitest";

import {
  buildPreferenceProfile,
  categorize,
  ratingToSignal,
  scoreCandidate,
  type CandidateTitle,
  type RatedSample,
} from "@/lib/recommendations/engine";

function sample(overrides: Partial<RatedSample> = {}): RatedSample {
  return {
    titleId: "t1",
    rating: 9,
    genres: ["drama"],
    directors: ["Christopher Nolan"],
    actors: ["Leonardo DiCaprio"],
    releaseYear: 2010,
    kind: "movie",
    runtimeMinutes: 148,
    ...overrides,
  };
}

function candidate(overrides: Partial<CandidateTitle> = {}): CandidateTitle {
  return {
    titleId: "c1",
    genres: ["drama"],
    directors: ["Christopher Nolan"],
    actors: ["Leonardo DiCaprio"],
    releaseYear: 2014,
    kind: "movie",
    runtimeMinutes: 169,
    externalRating: null,
    externalRatingSource: null,
    userRelation: "none",
    ...overrides,
  };
}

describe("ratingToSignal", () => {
  it("olcek ortasi (5.5) ve ortalamaya esit puan tam notr sinyal verir", () => {
    expect(ratingToSignal(5.5, 5.5)).toBe(0);
  });

  it("ortalamanin uzerindeki puan pozitif, altindaki negatif sinyal verir", () => {
    expect(ratingToSignal(9, 6)).toBeGreaterThan(0);
    expect(ratingToSignal(3, 6)).toBeLessThan(0);
  });

  it("ortalama puan, olcek ortasindan uzaksa kucuk de olsa isaret tasir", () => {
    // Kullanicinin ortalamasi 6 olan bir yapima 6 vermesi: goreli bilesen 0,
    // ancak mutlak bilesen hafif pozitif (6 > 5.5). Bu, her yapima yuksek
    // puan veren kullanicida profilin tamamen sifirlanmasini onler.
    const signal = ratingToSignal(6, 6);
    expect(signal).toBeGreaterThan(0);
    expect(signal).toBeLessThan(0.15);
  });

  it("yuksek puan pozitif, dusuk puan negatif sinyal verir", () => {
    expect(ratingToSignal(10, 6)).toBeGreaterThan(0.5);
    expect(ratingToSignal(2, 6)).toBeLessThan(-0.5);
  });

  it("-1..1 araliginda kalir", () => {
    expect(ratingToSignal(10, 0)).toBeLessThanOrEqual(1);
    expect(ratingToSignal(0, 10)).toBeGreaterThanOrEqual(-1);
  });
});

describe("buildPreferenceProfile", () => {
  it("bos veride sifir profil uretir", () => {
    const profile = buildPreferenceProfile([]);
    expect(profile.ratedCount).toBe(0);
    expect(profile.ratingMean).toBeNull();
    expect(profile.genreWeights.size).toBe(0);
  });

  it("yuksek puanli turleri pozitif agirlikla ogrenir", () => {
    const profile = buildPreferenceProfile([
      sample({ rating: 10, genres: ["bilim-kurgu"] }),
      sample({ titleId: "t2", rating: 9, genres: ["bilim-kurgu"] }),
      sample({ titleId: "t3", rating: 2, genres: ["korku"] }),
    ]);

    const sciFi = profile.genreWeights.get("bilim-kurgu");
    const horror = profile.genreWeights.get("korku");

    expect(sciFi?.sampleCount).toBe(2);
    expect(horror?.sampleCount).toBe(1);
    expect((sciFi?.weight ?? 0) / 2).toBeGreaterThan(0);
    expect((horror?.weight ?? 0) / 1).toBeLessThan(0);
  });

  it("ortalama ve standart sapmayi hesaplar", () => {
    const profile = buildPreferenceProfile([
      sample({ rating: 8 }),
      sample({ titleId: "t2", rating: 6 }),
    ]);
    expect(profile.ratingMean).toBe(7);
    expect(profile.ratingStdDev).toBeGreaterThan(0);
  });
});

describe("scoreCandidate", () => {
  it("puan yoksa sifir guven dondurur", () => {
    const profile = buildPreferenceProfile([]);
    const scored = scoreCandidate(candidate(), profile);
    expect(scored.confidence).toBe(0);
    expect(scored.uncertaintyNote).toContain("Hiç puan vermediniz");
  });

  it("sevilen tur/yönetmen icin pozitif gerekce uretir", () => {
    const profile = buildPreferenceProfile([
      sample({ rating: 10, genres: ["drama"], directors: ["Christopher Nolan"] }),
      sample({ titleId: "t2", rating: 9, genres: ["drama"], directors: ["Christopher Nolan"] }),
      sample({ titleId: "t3", rating: 8, genres: ["drama"], directors: ["Christopher Nolan"] }),
    ]);

    const scored = scoreCandidate(candidate(), profile);
    expect(scored.score).toBeGreaterThan(0);
    expect(scored.reasons.length).toBeGreaterThan(0);
    expect(scored.reasons.some((reason) => reason.factor === "genre")).toBe(true);
    expect(scored.reasons.some((reason) => reason.factor === "director")).toBe(true);
  });

  it("sevmeyen tur icin negatif katki uretir", () => {
    const profile = buildPreferenceProfile([
      sample({ rating: 2, genres: ["korku"], directors: [] }),
      sample({ titleId: "t2", rating: 3, genres: ["korku"], directors: [] }),
      sample({ titleId: "t3", rating: 2, genres: ["korku"], directors: [] }),
    ]);

    const scored = scoreCandidate(
      candidate({ genres: ["korku"], directors: [], actors: [] }),
      profile,
    );
    expect(scored.score).toBeLessThan(0);
    expect(scored.reasons.some((reason) => reason.factor === "genre_negative")).toBe(true);
  });

  it("guven puan sayisiyla artar", () => {
    const few = buildPreferenceProfile([sample({ rating: 9 })]);
    const many = buildPreferenceProfile(
      Array.from({ length: 20 }, (_, index) =>
        sample({ titleId: `t${index}`, rating: 8 }),
      ),
    );
    const fewScore = scoreCandidate(candidate(), few);
    const manyScore = scoreCandidate(candidate(), many);
    expect(manyScore.confidence).toBeGreaterThan(fewScore.confidence);
  });

  it("harici puanin kullanici verisi olmadigini belirtir", () => {
    const profile = buildPreferenceProfile(
      Array.from({ length: 5 }, (_, index) =>
        sample({ titleId: `t${index}`, rating: 7 }),
      ),
    );
    const scored = scoreCandidate(
      candidate({ genres: [], directors: [], actors: [], externalRating: 9 }),
      profile,
    );
    const externalReason = scored.reasons.find(
      (reason) => reason.factor === "external_rating",
    );
    expect(externalReason?.detail).toContain("kullanıcı verisi değildir");
  });
});

describe("categorize", () => {
  it("yuksek skorlulari guvenli oneri olarak isaretler", () => {
    const profile = buildPreferenceProfile([
      sample({ rating: 10 }),
      sample({ titleId: "t2", rating: 9 }),
      sample({ titleId: "t3", rating: 8 }),
    ]);
    const scored = [
      scoreCandidate(candidate({ titleId: "a" }), profile),
      scoreCandidate(candidate({ titleId: "b", genres: ["korku"], directors: [], actors: [] }), profile),
    ];
    const categorized = categorize(scored);
    expect(categorized[0].kind).toBe("safe");
    expect(categorized[categorized.length - 1].kind).toBe("discovery");
  });

  it("bos listeyi bos dondurur", () => {
    expect(categorize([])).toEqual([]);
  });
});
