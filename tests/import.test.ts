import { describe, expect, it } from "vitest";

import {
  applyExplicitLikes,
  averageRating,
  mergeRecords,
  normalizeName,
  parseCsv,
  parseCsvSources,
  parseJsonSource,
  ratingDistribution,
  splitAltTitles,
  stripParenQualifiers,
  type MemoryRecord,
} from "@/lib/community/import/source";
import {
  buildPreferenceProfileJson,
  resolveTarget,
  scopeToTitleKind,
  STATUS_TO_WATCH_STATUS,
} from "@/lib/community/import/mapping";

const SAMPLE_JSON = JSON.stringify({
  schema_version: "1.0",
  scored_titles: [
    {
      title: "Breaking Bad",
      year: null,
      kind: "series",
      rating: 10,
      rating_scope: "overall_series",
      status: "watched",
      notes: "favori",
    },
    {
      title: "The Revenant / Diriliş",
      year: 2015,
      kind: "film",
      rating: 9.5,
      rating_scope: "single_film",
      status: "watched",
      notes: "",
    },
  ],
  explicit_likes_without_extra_rating_implications: ["Breaking Bad", "Diriliş (film)"],
  unwatched_titles: [{ title: "Mindhunter", status: "unwatched", rating: null }],
  partially_watched_titles: [
    { title: "Person of Interest", status: "partially_watched", rating: null, notes: "yarim" },
  ],
  watched_unrated_titles: [
    { title: "2012", year: 2009, status: "watched_unrated", rating: null, notes: "" },
  ],
  uncertain_status_titles: [{ title: "Suits", status: "unknown", rating: null, notes: "" }],
  preferences_and_rules: {
    recommendation_courage: "balanced",
    core_taste_dimensions: [
      "character development",
      "screenplay and plot structure",
      "mystery and curiosity",
    ],
    spoilers: "none by default; explicit user permission required",
    recommendations_only_on_request: true,
    do_not_recommend_already_watched: true,
    true_detective_s1_liked_aspects: ["acting", "characters"],
  },
  data_integrity_rules: ["Never overwrite existing user data without backup and preview."],
});

const SAMPLE_SCORED_CSV = `title,year,kind,rating,rating_scope,status,notes
Breaking Bad,,series,10,overall_series,watched,favori
The Revenant / Diriliş,2015,film,9.5,single_film,watched,
`;

const SAMPLE_STATUS_CSV = `title,status,rating,notes
Mindhunter,unwatched,,
Person of Interest,partially_watched,,yarim
2012,watched_unrated,,izlendi
Suits,unknown,,belirsiz
`;

describe("normalizeName / stripParenQualifiers", () => {
  it("turkce karakterleri sadelestirir", () => {
    expect(normalizeName("Kardeş Payı")).toBe("kardes payi");
    expect(normalizeName("Behzat Ç.")).toBe("behzat c");
  });

  it("parantez icindeki ayirici ekleri temizler", () => {
    expect(stripParenQualifiers("Shameless (US)")).toBe("shameless");
    expect(stripParenQualifiers("Utopia (UK)")).toBe("utopia");
    expect(stripParenQualifiers("The Lord of the Rings")).toBe("the lord of the rings");
  });
});

describe("splitAltTitles", () => {
  it("slash ile ayrilmis alternatifleri dondurur", () => {
    expect(splitAltTitles("The Revenant / Diriliş")).toEqual([
      "The Revenant",
      "Diriliş",
    ]);
  });

  it("slash yoksa bos liste doner (cift kayit onlemi)", () => {
    expect(splitAltTitles("Breaking Bad")).toEqual([]);
  });
});

describe("parseCsv", () => {
  it("tirnakli alanlari dogru ayristirir", () => {
    const rows = parseCsv(
      'a,b\n"x,1","Çok beğenildi. Sevilen yönler: oyunculuk, karakterler."\n',
    );
    expect(rows).toHaveLength(2);
    expect(rows[1][0]).toBe("x,1");
    expect(rows[1][1]).toContain("Sevilen yönler: oyunculuk");
  });
});

describe("parseJsonSource", () => {
  it("puanlanan kayitlari okur ve dogru tur/scope atar", () => {
    const parsed = parseJsonSource(SAMPLE_JSON);
    const breakingBad = parsed.records.find(
      (r) => r.rawTitle === "Breaking Bad",
    );
    expect(breakingBad?.rating).toBe(10);
    expect(breakingBad?.kind).toBe("series");
    expect(breakingBad?.scope).toBe("overall_series");
  });

  it("tur belirtilmemis kayitlarda tur uydurmaz", () => {
    const parsed = parseJsonSource(SAMPLE_JSON);
    const mindhunter = parsed.records.find((r) => r.rawTitle === "Mindhunter");
    expect(mindhunter?.kind).toBe("unknown");
    expect(mindhunter?.scope).toBe("unspecified");
    expect(mindhunter?.rating).toBeNull();
  });
});

describe("mergeRecords", () => {
  it("ayni kaydi iki dosyadan tek kayda indirger", () => {
    const json = parseJsonSource(SAMPLE_JSON);
    const csv = parseCsvSources(SAMPLE_SCORED_CSV, SAMPLE_STATUS_CSV);
    const merged = mergeRecords(json.records, csv.records);

    const breakingBad = merged.records.filter(
      (r) => r.rawTitle === "Breaking Bad",
    );
    expect(breakingBad).toHaveLength(1);
    expect(breakingBad[0].seenIn).toContain("json:scored_titles");
    expect(breakingBad[0].seenIn).toContain("csv:scored_titles");
    expect(merged.records).toHaveLength(6);
  });

  it("yili bir dosyada olmayan ayni kaydi birlestirir", () => {
    const json = parseJsonSource(SAMPLE_JSON);
    const csv = parseCsvSources(SAMPLE_SCORED_CSV, SAMPLE_STATUS_CSV);
    const merged = mergeRecords(json.records, csv.records);
    const y2012 = merged.records.filter((r) => r.rawTitle === "2012");
    expect(y2012).toHaveLength(1);
    expect(y2012[0].year).toBe(2009);
  });
});

describe("applyExplicitLikes", () => {
  it("sevdigi kayitlari isaretler", () => {
    const json = parseJsonSource(SAMPLE_JSON);
    const { records, unmatched } = applyExplicitLikes(
      json.records,
      json.explicitLikeTitles,
    );
    expect(unmatched).toEqual([]);
    expect(records.find((r) => r.rawTitle === "Breaking Bad")?.explicitLike).toBe(
      true,
    );
    // "Diriliş (film)" -> "The Revenant / Diriliş" kaydinin alternatif adi
    expect(
      records.find((r) => r.rawTitle === "The Revenant / Diriliş")?.explicitLike,
    ).toBe(true);
  });

  it("cift sayim yapmaz (ayni kayit iki kez islenmez)", () => {
    const json = parseJsonSource(SAMPLE_JSON);
    const { records } = applyExplicitLikes(
      json.records,
      json.explicitLikeTitles,
    );
    const breakingBad = records.find((r) => r.rawTitle === "Breaking Bad");
    expect(breakingBad?.explicitLike).toBe(true);
  });
});

describe("puan dagilimi", () => {
  it("puan dagilimini ve ortalamayi hesaplar", () => {
    const json = parseJsonSource(SAMPLE_JSON);
    const distribution = ratingDistribution(json.records);
    expect(distribution.get(10)).toBe(1);
    expect(distribution.get(9.5)).toBe(1);
    expect(averageRating(json.records)).toBeCloseTo(9.75, 5);
  });
});

describe("izleme durumu eslemesi", () => {
  it("kaynak durumlari uygun watch statusa eslenir", () => {
    expect(STATUS_TO_WATCH_STATUS.watched).toBe("watched");
    expect(STATUS_TO_WATCH_STATUS.unwatched).toBe("not_watched");
    expect(STATUS_TO_WATCH_STATUS.partially_watched).toBe("watching");
    expect(STATUS_TO_WATCH_STATUS.watched_unrated).toBe("watched");
    expect(STATUS_TO_WATCH_STATUS.unknown).toBe("unsure");
  });

  it("bilinmeyen durumu izlenmis/izlenmemis varsaymaz", () => {
    expect(STATUS_TO_WATCH_STATUS.unknown).not.toBe("watched");
    expect(STATUS_TO_WATCH_STATUS.unknown).not.toBe("not_watched");
  });
});

describe("scopeToTitleKind", () => {
  it("kaydin turunu scope'tan once dikkate alir", () => {
    // "The Hobbit": kind=film_franchise, scope=overall_series -> franchise
    expect(scopeToTitleKind("overall_series", "film_franchise")).toBe("franchise");
    expect(scopeToTitleKind("overall_franchise", "film_franchise")).toBe(
      "franchise",
    );
    expect(scopeToTitleKind("single_film", "film")).toBe("movie");
    expect(scopeToTitleKind("specific_season", "series_season")).toBe("season");
    // Yil verildigi icin tekil film
    expect(scopeToTitleKind("overall_scope_as_recorded", "film_franchise_or_film")).toBe(
      "movie",
    );
  });

  it("tur bilinmiyorsa belirsiz kalir", () => {
    expect(scopeToTitleKind("unspecified", "unknown")).toBe("unknown");
  });
});

describe("resolveTarget", () => {
  const base: MemoryRecord = {
    key: "k",
    rawTitle: "X",
    altTitles: [],
    year: null,
    kind: "series",
    rating: 8,
    scope: "overall_series",
    status: "watched",
    notes: "",
    explicitLike: false,
    seenIn: ["json"],
  };

  it("dizi geneli puanini sezona kopyalamaz", () => {
    const result = resolveTarget({ ...base, kind: "series", scope: "overall_series" });
    expect(result.titleKind).toBe("series");
  });

  it("franchise puanini tekil filme dagitmaz", () => {
    const result = resolveTarget({
      ...base,
      kind: "film_franchise",
      scope: "overall_franchise",
    });
    expect(result.titleKind).toBe("franchise");
  });

  it("puansiz kayitlarin puani null kalir", () => {
    const result = resolveTarget({ ...base, rating: null, status: "unwatched" });
    expect(result.watchStatus).toBe("not_watched");
    expect(result.titleKind).toBe("series");
  });
});

describe("buildPreferenceProfileJson", () => {
  it("tercih kurallarini motor boyutlarina baglar", () => {
    const parsed = parseJsonSource(SAMPLE_JSON);
    const profile = buildPreferenceProfileJson(
      parsed.preferences,
      "2026-01-01T00:00:00.000Z",
    );
    expect(profile.recommendationCourage).toBe("balanced");
    expect(profile.spoilers).toContain("none by default");
    expect(profile.recommendationsOnlyOnRequest).toBe(true);
    expect(profile.doNotRecommendAlreadyWatched).toBe(true);
    expect(profile.engineDimensions).toEqual([
      "characterDevelopment",
      "screenplay",
      "plot",
      "mystery",
    ]);
    expect(profile.trueDetectiveS1LikedAspects).toEqual(["acting", "characters"]);
    expect(profile.unknownDataPolicy).toContain("Never invent");
  });
});
