import { describe, expect, it } from "vitest";

import { spoilerLabel, spoilerState } from "@/lib/spoilers/rules";
import { detectSpoilerRisk } from "@/lib/spoilers/risk";

describe("spoilerState", () => {
  it("spoiler icermeyen icerik her zaman gorunur", () => {
    expect(
      spoilerState(
        { status: "not_watched", season: null, episode: null },
        { containsSpoiler: false, scopeSeason: null },
      ),
    ).toBe("visible");
  });

  it("izlenmis yapimda spoiler gosterilir", () => {
    expect(
      spoilerState(
        { status: "watched", season: null, episode: null },
        { containsSpoiler: true, scopeSeason: 5 },
      ),
    ).toBe("visible");
  });

  it("ilerleme bilinmiyorsa spoiler gizlenir", () => {
    expect(
      spoilerState(
        { status: "watching", season: null, episode: null },
        { containsSpoiler: true, scopeSeason: 1 },
      ),
    ).toBe("hidden");
  });

  it("kullanicinin geldigi sezona kadarki spoiler gorunur", () => {
    expect(
      spoilerState(
        { status: "watching", season: 3, episode: 4 },
        { containsSpoiler: true, scopeSeason: 3 },
      ),
    ).toBe("visible");
  });

  it("kullanicinin gerisinde kalan sezon spoileri gizlenir", () => {
    expect(
      spoilerState(
        { status: "watching", season: 2, episode: 1 },
        { containsSpoiler: true, scopeSeason: 4 },
      ),
    ).toBe("hidden");
  });

  it("kapsam belirsizse (tum yapim) gizlenir", () => {
    expect(
      spoilerState(
        { status: "watching", season: 5, episode: 1 },
        { containsSpoiler: true, scopeSeason: null },
      ),
    ).toBe("hidden");
  });
});

describe("spoilerLabel", () => {
  it("kapsam belirtilince sezon bilgisini gosterir", () => {
    expect(spoilerLabel({ containsSpoiler: true, scopeSeason: 2 })).toContain(
      "2. sezona kadar",
    );
  });

  it("spoiler yoksa etiket dondurmez", () => {
    expect(spoilerLabel({ containsSpoiler: false, scopeSeason: null })).toBeNull();
  });
});

describe("detectSpoilerRisk", () => {
  it("bos/kisa metni degerlendirilemedi olarak isaretler", () => {
    expect(detectSpoilerRisk("")).toBe("unknown");
    expect(detectSpoilerRisk("Kısa metin.")).toBe("unknown");
  });

  it("spoiler isareti olmayan uzun metni dusuk riskli sayar", () => {
    const text =
      "Film, 1950'lerde geçen bir dönem dramı olarak çekildi ve görüntü yönetimi " +
      "ile dikkat çekti. Oyuncu kadrosu geniş bir ekiple çalıştı.";
    expect(detectSpoilerRisk(text)).toBe("low");
  });

  it("birden fazla guclu sinyal varsa yuksek risk verir", () => {
    const text =
      "The plot twist reveals that the protagonist is actually the killer, and the " +
      "finale confirms who dies in the last scene.";
    expect(detectSpoilerRisk(text)).toBe("high");
  });

  it("tek guclu sinyal orta risk verir", () => {
    const text =
      "Eleştirmenler filmin atmosferini ve oyunculuklarını övdü; yazı ayrıca " +
      "sürpriz bir gelişmeden kısaca söz ediyor ve genel olarak olumlu bir ton taşıyor.";
    expect(detectSpoilerRisk(text)).toBe("medium");
  });
});
