/**
 * Spoiler koruma kurallari (saf fonksiyonlar).
 *
 * Amac: kullanicinin izleme ilerlemesine gore bir icerigin gosterilip
 * gosterilmeyecegine karar vermek. Hicbir tahmin yapilmaz; yalnizca
 * kullanicinin KENDI bildirdigi ilerleme kullanilir. Ilerleme bilinmiyorsa
 * guvenli taraf secilir (icerik gizlenir).
 */

export type SpoilerViewer = {
  /** Kullanicinin bu yapimla ilgili izleme durumu; kayit yoksa null. */
  status:
    | "watched"
    | "not_watched"
    | "watching"
    | "dropped"
    | "watchlist"
    | "unsure"
    | null;
  /** Dizi icin kullanicinin izledigi son sezon (1 tabanli). */
  season: number | null;
  /** Dizi icin izlenen son bolum (opsiyonel). */
  episode: number | null;
};

export type SpoilerContent = {
  containsSpoiler: boolean;
  /** Icerigin spoiler kapsami: hangi sezona kadar. null = tum yapim. */
  scopeSeason: number | null;
};

export type SpoilerState = "visible" | "hidden";

/**
 * Icerigin gorunup gorunmeyecegini belirler.
 *
 * Kurallar:
 *  1. Icerik spoiler icermiyorsa her zaman goruntulenir.
 *  2. Kullanici yapimi tamamen izlemisse (watched) her zaman goruntulenir.
 *  3. Icerik belirli bir sezona kadar spoiler iceriyorsa ve kullanici o
 *     sezona kadar geldiyse goruntulenir.
 *  4. Diger tum durumlarda (ilerleme bilinmiyor, kapsam belirsiz, kullanici
 *     geride) icerik gizlenir.
 */
export function spoilerState(
  viewer: SpoilerViewer,
  content: SpoilerContent,
): SpoilerState {
  if (!content.containsSpoiler) return "visible";
  if (viewer.status === "watched") return "visible";

  // Kapsam belirtilmemisse tum yapim icin spoiler sayilir: gizle.
  if (content.scopeSeason === null) return "hidden";

  // Ilerleme bilinmiyorsa gizle.
  if (viewer.season === null) return "hidden";

  return content.scopeSeason <= viewer.season ? "visible" : "hidden";
}

/** Kisa, kullaniciya gosterilecek spoiler etiketi. */
export function spoilerLabel(content: SpoilerContent): string | null {
  if (!content.containsSpoiler) return null;
  if (content.scopeSeason === null) {
    return "Spoiler içerir (tüm yapım)";
  }
  return `Spoiler içerir (${content.scopeSeason}. sezona kadar)`;
}

/** Kullanicinin ilerleme ozetini insan okunur bicimde dondurur. */
export function viewerProgressSummary(viewer: SpoilerViewer): string {
  if (viewer.status === "watched") return "Yapımı izlediniz.";
  if (viewer.status === null) return "Bu yapım için izleme bilginiz yok.";
  if (viewer.season === null) return "İzleme ilerlemeniz kayıtlı değil.";
  if (viewer.episode !== null) {
    return `İlerlemeniz: ${viewer.season}. sezon ${viewer.episode}. bölüm.`;
  }
  return `İlerlemeniz: ${viewer.season}. sezon.`;
}
