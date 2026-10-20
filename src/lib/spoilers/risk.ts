/**
 * Bir metnin spoiler riskini kaba sezgisel (heuristic) olarak tahmin eder.
 *
 * ONEMLI: Bu bir SINIFLANDIRMA TAHMINIDIR, kesin bir olgu degildir. Bu
 * yuzden `unknown` durumu vardir ve sonuc kullaniciya "tahmin" olarak
 * sunulmalidir. Kaynak metnin kendisi degistirilmez.
 */

export type SpoilerRisk = "low" | "medium" | "high" | "unknown";

/** Turkce + Ingilizce spoiler isaretleri (kelime siniri ile aranir). */
const HIGH_SIGNALS = [
  "spoiler",
  "twist",
  "plot twist",
  "ending explained",
  "the ending",
  "finale",
  "who dies",
  "dies",
  "death of",
  "killed",
  "reveals",
  "revealed",
  "it is revealed",
  "identity of",
  "final scene",
  "last scene",
  "sürpriz",
  "ters köşe",
  "sonu",
  "finali",
  "final sahnesi",
  "son sahne",
  "ölür",
  "öldürür",
  "katil",
  "kim olduğu ortaya çıkar",
  "ifşa",
];

const MEDIUM_SIGNALS = [
  "climax",
  "resolution",
  "conclusion",
  "aftermath",
  "turns out",
  "it turns out",
  "we learn",
  "backstory",
  "flashback",
  "çözülür",
  "ortaya çıkar",
  "gerçek ortaya",
  "geçmişi",
  "açıklanır",
];

function countMatches(text: string, signals: string[]): number {
  let count = 0;
  for (const signal of signals) {
    const pattern = new RegExp(
      `(^|[^\\p{L}])${escapeRegExp(signal)}([^\\p{L}]|$)`,
      "iu",
    );
    if (pattern.test(text)) count += 1;
  }
  return count;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Metnin spoiler riskini tahmin eder.
 *  - Cok kisa/bos metin: `unknown` (degerlendirmek icin yetersiz).
 *  - Yuksek sinyal sayisi >= 2: `high`.
 *  - Tek yuksek veya >= 2 orta sinyal: `medium`.
 *  - Hicbir sinyal yok: `low`.
 */
export function detectSpoilerRisk(text: string): SpoilerRisk {
  const trimmed = text.trim();
  if (trimmed.length < 40) return "unknown";

  const high = countMatches(trimmed, HIGH_SIGNALS);
  const medium = countMatches(trimmed, MEDIUM_SIGNALS);

  if (high >= 2) return "high";
  if (high === 1 || medium >= 2) return "medium";
  return "low";
}

export function spoilerRiskLabel(risk: SpoilerRisk): string {
  switch (risk) {
    case "high":
      return "Spoiler riski yüksek (tahmin)";
    case "medium":
      return "Spoiler riski orta (tahmin)";
    case "low":
      return "Spoiler riski düşük (tahmin)";
    default:
      return "Spoiler riski değerlendirilemedi";
  }
}
