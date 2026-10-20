import { describe, expect, it } from "vitest";

import { buildSystemPrompt } from "@/lib/ai/prompt";

describe("buildSystemPrompt", () => {
  it("yapim adini ve turunu icerir", () => {
    const prompt = buildSystemPrompt({
      titleName: "Breaking Bad",
      kind: "series",
      year: 2008,
      spoilerMode: "all",
      spoilerSeason: null,
    });
    expect(prompt).toContain("Breaking Bad");
    expect(prompt).toContain("dizi");
    expect(prompt).toContain("2008");
  });

  it("'none' modunda kesin spoiler yasagi koyar", () => {
    const prompt = buildSystemPrompt({
      titleName: "Inception",
      kind: "movie",
      year: 2010,
      spoilerMode: "none",
      spoilerSeason: null,
    });
    expect(prompt).toContain("SPOILER KURALI");
    expect(prompt.toLowerCase()).toContain("spoiler verme");
  });

  it("'season' modunda sezon numarasini belirtir", () => {
    const prompt = buildSystemPrompt({
      titleName: "Breaking Bad",
      kind: "series",
      year: 2008,
      spoilerMode: "season",
      spoilerSeason: 3,
    });
    expect(prompt).toContain("3. sezona kadar");
    expect(prompt).toContain("sonrasına");
  });

  it("ilerleme bilinmiyorsa temkinli davranir", () => {
    const prompt = buildSystemPrompt({
      titleName: "Breaking Bad",
      kind: "series",
      year: 2008,
      spoilerMode: "progress",
      spoilerSeason: null,
    });
    expect(prompt).toContain("bilinmiyor");
  });

  it("'all' modunda tum olay orgusune izin verir", () => {
    const prompt = buildSystemPrompt({
      titleName: "Inception",
      kind: "movie",
      year: 2010,
      spoilerMode: "all",
      spoilerSeason: null,
    });
    expect(prompt).toContain("tamamını izlediğini");
  });
});
