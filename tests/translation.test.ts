import { describe, expect, it } from "vitest";

import { cleanTranslation } from "@/lib/ai/translation-text";

describe("cleanTranslation", () => {
  it("bastaki çeviri etiketini atar", () => {
    expect(cleanTranslation("Çeviri: Film büyük beğeni topladı.")).toBe(
      "Film büyük beğeni topladı.",
    );
    expect(cleanTranslation("Translation: The film was praised.")).toBe(
      "The film was praised.",
    );
  });

  it("metni saran tırnakları atar", () => {
    expect(cleanTranslation('"Film büyük beğeni topladı."')).toBe(
      "Film büyük beğeni topladı.",
    );
    expect(cleanTranslation("“Film büyük beğeni topladı.”")).toBe(
      "Film büyük beğeni topladı.",
    );
  });

  it("metin içindeki tırnaklara dokunmaz", () => {
    expect(
      cleanTranslation('Seyirciler filmi "B+" notuyla değerlendirdi.'),
    ).toBe('Seyirciler filmi "B+" notuyla değerlendirdi.');
  });

  it("boşlukları temizler", () => {
    expect(cleanTranslation("   Film iyiydi.  \n")).toBe("Film iyiydi.");
  });

  it("boş girdide boş döner", () => {
    expect(cleanTranslation("   ")).toBe("");
  });
});
