/**
 * Oneri motorunun saf (pure) cekirdegi.
 *
 * Tasarim ilkeleri:
 *  - Yalnizca kullanicinin GERCEK verileri kullanilir (puan, durum, not).
 *  - Hicbir kullanici tercihi varsayilmaz; kanit yoksa agirlik 0'dir.
 *  - Her katkinin gerekcesi ayri ayri dondurulur (aciklanabilirlik).
 *  - Sonuc, kanit miktarina bagli bir guven degeri tasir.
 */

export const DIMENSIONS = [
  "characterDevelopment",
  "screenplay",
  "plot",
  "mystery",
  "twists",
  "psychologicalDepth",
  "atmosphere",
  "pacing",
  "worldBuilding",
  "emotionalImpact",
  "humor",
  "action",
  "thematicDepth",
  "dialogue",
  "originality",
] as const;

export type Dimension = (typeof DIMENSIONS)[number];

export const DIMENSION_LABELS: Record<Dimension, string> = {
  characterDevelopment: "Karakter gelişimi",
  screenplay: "Senaryo kalitesi",
  plot: "Olay örgüsü",
  mystery: "Gizem ve merak",
  twists: "Ters köşe ve sürprizler",
  psychologicalDepth: "Psikolojik derinlik",
  atmosphere: "Atmosfer",
  pacing: "Tempo",
  worldBuilding: "Dünya kurma",
  emotionalImpact: "Duygusal etki",
  humor: "Mizah",
  action: "Aksiyon",
  thematicDepth: "Tematik derinlik",
  dialogue: "Diyalog kalitesi",
  originality: "Özgünlük",
};

export type RatedSample = {
  titleId: string;
  rating: number; // 1..10
  genres: string[];
  directors: string[];
  actors: string[];
  releaseYear: number | null;
  kind: "movie" | "series";
  runtimeMinutes: number | null;
};

export type CandidateTitle = {
  titleId: string;
  genres: string[];
  directors: string[];
  actors: string[];
  releaseYear: number | null;
  kind: "movie" | "series";
  runtimeMinutes: number | null;
  externalRating: number | null;
  externalRatingSource: string | null;
  /** Kullanicinin bu yapimla ilgili dogrulanmis kaydi var mi? */
  userRelation: "none" | "not_watched" | "watchlist" | "watched" | "watching" | "dropped";
};

export type ReasonFactor = {
  factor: string;
  contribution: number;
  detail: string;
};

export type ScoredRecommendation = {
  titleId: string;
  kind: "safe" | "discovery" | "rewatch";
  score: number;
  confidence: number;
  uncertaintyNote: string;
  reasons: ReasonFactor[];
  /** Kullanicinin bu yapimla ilgisi (izlenmis/izlenmemis bilinmiyor). */
  relation: CandidateTitle["userRelation"];
};

/* -------------------------------------------------------------------------- */
/* Tercih profili                                                             */
/* -------------------------------------------------------------------------- */

export type PreferenceProfile = {
  genreWeights: Map<string, { weight: number; sampleCount: number }>;
  directorWeights: Map<string, { weight: number; sampleCount: number }>;
  actorWeights: Map<string, { weight: number; sampleCount: number }>;
  decadeWeights: Map<string, { weight: number; sampleCount: number }>;
  kindWeights: Map<string, { weight: number; sampleCount: number }>;
  runtimeMean: number | null;
  ratedCount: number;
  /** Ortalama puan; kullanicinin "iyi" esigi. */
  ratingMean: number | null;
  ratingStdDev: number | null;
};

/**
 * Puanı tercih sinyaline cevirir (-1..1).
 *
 * Iki bilesen birlestirilir:
 *  - Mutlak bilesen: puan 5.5'in uzerindeyse pozitif, altindaysa negatif.
 *  - Goreli bilesen: kullanicinin kendi ortalamasina gore sapma.
 *
 * Yalnizca goreli bilesen kullanilsaydi, her yapima 8-10 arasi puan veren
 * bir kullanicida hicbir yapim "one cikmaz" ve oneri uretilemezdi.
 */
export function ratingToSignal(rating: number, mean: number): number {
  const absolute = (rating - 5.5) / 4.5;
  const relative = (rating - mean) / 4.5;
  const combined = absolute * 0.6 + relative * 0.4;
  return Math.max(-1, Math.min(1, combined));
}

export function buildPreferenceProfile(samples: RatedSample[]): PreferenceProfile {
  const genreWeights = new Map<string, { weight: number; sampleCount: number }>();
  const directorWeights = new Map<string, { weight: number; sampleCount: number }>();
  const actorWeights = new Map<string, { weight: number; sampleCount: number }>();
  const decadeWeights = new Map<string, { weight: number; sampleCount: number }>();
  const kindWeights = new Map<string, { weight: number; sampleCount: number }>();

  const ratings = samples.map((sample) => sample.rating);
  const ratedCount = samples.length;
  const ratingMean =
    ratedCount > 0 ? ratings.reduce((sum, value) => sum + value, 0) / ratedCount : null;
  const ratingStdDev =
    ratingMean !== null && ratedCount > 1
      ? Math.sqrt(
          ratings.reduce((sum, value) => sum + (value - ratingMean) ** 2, 0) /
            (ratedCount - 1),
        )
      : null;

  const add = (
    map: Map<string, { weight: number; sampleCount: number }>,
    key: string,
    signal: number,
  ) => {
    const current = map.get(key) ?? { weight: 0, sampleCount: 0 };
    current.weight += signal;
    current.sampleCount += 1;
    map.set(key, current);
  };

  for (const sample of samples) {
    const signal =
      ratingMean !== null ? ratingToSignal(sample.rating, ratingMean) : 0;
    for (const genre of sample.genres) add(genreWeights, genre, signal);
    for (const director of sample.directors) add(directorWeights, director, signal);
    for (const actor of sample.actors) add(actorWeights, actor, signal * 0.6);
    if (sample.releaseYear) {
      add(decadeWeights, `${Math.floor(sample.releaseYear / 10) * 10}`, signal);
    }
    add(kindWeights, sample.kind, signal);
  }

  const runtimes = samples
    .map((sample) => sample.runtimeMinutes)
    .filter((value): value is number => typeof value === "number" && value > 0);

  return {
    genreWeights,
    directorWeights,
    actorWeights,
    decadeWeights,
    kindWeights,
    runtimeMean:
      runtimes.length > 0
        ? runtimes.reduce((sum, value) => sum + value, 0) / runtimes.length
        : null,
    ratedCount,
    ratingMean,
    ratingStdDev,
  };
}

/** Ortalamaya yakinligi normalize eder; az ornekte asiri guveni engeller. */
function normalizedWeight(entry?: { weight: number; sampleCount: number }): number {
  if (!entry || entry.sampleCount === 0) return 0;
  // 3 ornekten sonra tam guven.
  const confidence = Math.min(1, entry.sampleCount / 3);
  const mean = entry.weight / entry.sampleCount;
  return mean * confidence;
}

/* -------------------------------------------------------------------------- */
/* Skorlama                                                                   */
/* -------------------------------------------------------------------------- */

export function scoreCandidate(
  candidate: CandidateTitle,
  profile: PreferenceProfile,
  options: { excludedGenres?: Set<string> } = {},
): ScoredRecommendation {
  const reasons: ReasonFactor[] = [];
  let score = 0;

  // 1) Tur yakinligi (en guclu sinyal)
  const genreScores: { genre: string; value: number }[] = [];
  for (const genre of candidate.genres) {
    if (options.excludedGenres?.has(genre)) continue;
    const value = normalizedWeight(profile.genreWeights.get(genre));
    if (value !== 0) genreScores.push({ genre, value });
  }
  if (genreScores.length > 0) {
    genreScores.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    const top = genreScores.slice(0, 3);
    const contribution = top.reduce((sum, item) => sum + item.value, 0) * 1.8;
    score += contribution;
    const positive = top.filter((item) => item.value > 0);
    const negative = top.filter((item) => item.value < 0);
    if (positive.length > 0) {
      reasons.push({
        factor: "genre",
        contribution: Number(contribution.toFixed(2)),
        detail: `Yüksek puan verdiğiniz yapımlarla ortak tür: ${positive
          .map((item) => item.genre)
          .join(", ")}`,
      });
    }
    if (negative.length > 0) {
      reasons.push({
        factor: "genre_negative",
        contribution: Number(
          (negative.reduce((sum, item) => sum + item.value, 0) * 1.8).toFixed(2),
        ),
        detail: `Düşük puan verdiğiniz yapımlarla ortak tür: ${negative
          .map((item) => item.genre)
          .join(", ")}`,
      });
    }
  }

  // 2) Yonetmen yakinligi
  const directorScores = candidate.directors
    .map((name) => ({ name, value: normalizedWeight(profile.directorWeights.get(name)) }))
    .filter((item) => Math.abs(item.value) > 0.05);
  if (directorScores.length > 0) {
    const contribution =
      directorScores.reduce((sum, item) => sum + item.value, 0) * 1.4;
    score += contribution;
    reasons.push({
      factor: "director",
      contribution: Number(contribution.toFixed(2)),
      detail:
        directorScores[0].value > 0
          ? `Daha önce yüksek puan verdiğiniz bir yönetmenin işi: ${directorScores[0].name}`
          : `Daha önce düşük puan verdiğiniz bir yönetmenin işi: ${directorScores[0].name}`,
    });
  }

  // 3) Oyuncu yakinligi (daha zayif sinyal)
  const actorScores = candidate.actors
    .map((name) => ({ name, value: normalizedWeight(profile.actorWeights.get(name)) }))
    .filter((item) => Math.abs(item.value) > 0.08);
  if (actorScores.length > 0) {
    const contribution =
      actorScores.slice(0, 3).reduce((sum, item) => sum + item.value, 0) * 0.8;
    score += contribution;
    reasons.push({
      factor: "actor",
      contribution: Number(contribution.toFixed(2)),
      detail: `Beğendiğiniz yapımlarda rol alan oyuncu: ${actorScores
        .slice(0, 2)
        .map((item) => item.name)
        .join(", ")}`,
    });
  }

  // 4) Donem yakinligi
  if (candidate.releaseYear) {
    const decade = `${Math.floor(candidate.releaseYear / 10) * 10}`;
    const value = normalizedWeight(profile.decadeWeights.get(decade));
    if (Math.abs(value) > 0.05) {
      const contribution = value * 0.6;
      score += contribution;
      reasons.push({
        factor: "decade",
        contribution: Number(contribution.toFixed(2)),
        detail: `${decade}'li yıllara olan eğiliminiz`,
      });
    }
  }

  // 5) Yapim turu (film/dizi)
  const kindValue = normalizedWeight(profile.kindWeights.get(candidate.kind));
  if (Math.abs(kindValue) > 0.05) {
    const contribution = kindValue * 0.7;
    score += contribution;
    reasons.push({
      factor: "kind",
      contribution: Number(contribution.toFixed(2)),
      detail:
        candidate.kind === "series"
          ? "Dizi tercihlerinizle uyumlu"
          : "Film tercihlerinizle uyumlu",
    });
  }

  // 6) Sure yakinligi (yalnizca kullanicinin izledigi ortalamasi varsa)
  if (
    profile.runtimeMean !== null &&
    candidate.runtimeMinutes !== null &&
    candidate.runtimeMinutes > 0
  ) {
    const diff = Math.abs(candidate.runtimeMinutes - profile.runtimeMean);
    const penalty = Math.min(0.5, diff / 120) * 0.5;
    if (penalty > 0.02) {
      score -= penalty;
      reasons.push({
        factor: "runtime",
        contribution: Number((-penalty).toFixed(2)),
        detail: `Alıştığınız süreden (${Math.round(profile.runtimeMean)} dk) farklı: ${candidate.runtimeMinutes} dk`,
      });
    }
  }

  // 7) Harici puan: zayif oncel (kullanici verisi degildir, acikca belirtilir)
  if (candidate.externalRating !== null && profile.ratedCount >= 3) {
    const normalized = (candidate.externalRating - 5) / 5; // 5 -> 0, 10 -> 1
    const contribution = normalized * 0.35;
    score += contribution;
    if (Math.abs(contribution) > 0.05) {
      reasons.push({
        factor: "external_rating",
        contribution: Number(contribution.toFixed(2)),
        detail: `Harici platform puanı ${candidate.externalRating.toFixed(1)} (${candidate.externalRatingSource ?? "kaynak"}) — kullanıcı verisi değildir`,
      });
    }
  }

  // Guven: puan sayisina ve kanit cesitliligine bagli.
  const ratedCount = profile.ratedCount;
  const confidence =
    ratedCount === 0
      ? 0
      : Math.min(1, Math.log10(ratedCount + 1) / Math.log10(21)); // 20 puan -> ~1

  let uncertaintyNote: string;
  if (ratedCount === 0) {
    uncertaintyNote =
      "Hiç puan vermediniz; bu öneri yalnızca harici verilere dayanıyor ve kişisel tercihinizi yansıtmıyor olabilir.";
  } else if (ratedCount < 5) {
    uncertaintyNote = `Yalnızca ${ratedCount} puanınız var. Öneri güveni düşük; daha fazla yapım puanladıkça isabet artar.`;
  } else if (ratedCount < 15) {
    uncertaintyNote = `${ratedCount} puanınıza dayanıyor. Tercih profiliniz oluşuyor ancak henüz kesin değil.`;
  } else {
    uncertaintyNote = `${ratedCount} puanınıza dayanıyor. Yine de öneri bir tahmindir, kesin bir tercih değildir.`;
  }

  return {
    titleId: candidate.titleId,
    kind: "safe",
    score: Number(score.toFixed(4)),
    confidence: Number(confidence.toFixed(3)),
    uncertaintyNote,
    reasons,
    relation: candidate.userRelation,
  };
}

/**
 * Onerileri "guvenli" ve "kesif" olarak ayirir.
 *  - safe: profil sinyalleriyle guclu uyum
 *  - discovery: profil disina cikan ama yine de makul (dusuk ama pozitif skor)
 */
export function categorize(
  scored: ScoredRecommendation[],
): ScoredRecommendation[] {
  if (scored.length === 0) return [];

  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const cutoffIndex = Math.max(1, Math.floor(sorted.length * 0.6));

  return sorted.map((item, index) => ({
    ...item,
    kind: index < cutoffIndex ? "safe" : "discovery",
  }));
}

/** Bir yapimin neden onerilmedigini aciklar (elenme nedeni). */
export function explainExclusion(
  candidate: CandidateTitle,
  profile: PreferenceProfile,
): string | null {
  if (candidate.userRelation === "watched") return "Zaten izlediniz.";
  if (candidate.userRelation === "watching") return "Halen izliyorsunuz.";
  if (candidate.userRelation === "dropped") return "Yarım bıraktınız.";
  if (candidate.userRelation === "watchlist") return "İzleme listenizde.";
  if (profile.ratedCount === 0) return "Karşılaştırma için yeterli puanınız yok.";
  return null;
}
