/**
 * Katalogdaki yapimlari turlerine gore satirlara ayirir (saf fonksiyon).
 *
 * UX kurali: bir yapim yalnizca TEK bir tur satirinda gorunur. Aksi halde
 * ayni afis "Dram", "Gizem", "Bilim Kurgu" gibi satirlarda tekrar tekrar
 * karsimiza cikiyor ve kesfetme hissi yorucu oluyor.
 *
 * Atama yontemi: her yapim, sahip oldugu turler arasindan katalogda en az
 * bulunan (en ozgul) ture yerlestirilir. Boylece "Dram" gibi dev bir havuz
 * her seyi yutmaz; tur satirlari birbirinden farkli ve dengeli olur.
 *
 * - `minItems`: bu sayidan az yapimi olan tur satir olmaz. Boyle bir tur
 *   kapanirsa icindeki yapimlar bir sonraki uygun turlerine gecer; hicbiri
 *   kaybolmaz (en kotu ihtimalle "Türsüz" satirina duser).
 * - `Türsüz` her zaman en sonda listelenir.
 */
export type GenreGroup<T> = { name: string; items: T[] };

export const NO_GENRE_LABEL = "Türsüz";

export function groupByGenre<T extends { genres: string[] }>(
  items: T[],
  options: { minItems?: number } = {},
): GenreGroup<T>[] {
  if (items.length === 0) return [];

  const minItems = Math.max(1, options.minItems ?? 1);

  // Ayni tur birden fazla kez yazilmis olabilir; tekilleştir.
  const normalized = items.map((item) => ({
    item,
    genres: [
      ...new Set(
        item.genres
          .map((genre) => genre.trim())
          .filter((genre) => genre.length > 0),
      ),
    ],
  }));

  // Her turun katalogdaki toplam yapim sayisi (ozgulluk / denge icin).
  const totals = new Map<string, number>();
  for (const entry of normalized) {
    for (const genre of entry.genres) {
      totals.set(genre, (totals.get(genre) ?? 0) + 1);
    }
  }

  const eligible = new Set(
    [...totals.entries()]
      .filter(([, count]) => count >= minItems)
      .map(([genre]) => genre),
  );

  /**
   * Yapimlari uygun turlere dagitir. Ayni yapim yalnizca bir kez eklenir.
   */
  const build = () => {
    const map = new Map<string, T[]>();
    for (const { item, genres } of normalized) {
      const candidates = genres.filter((genre) => eligible.has(genre));
      let name = NO_GENRE_LABEL;

      if (candidates.length > 0) {
        name = candidates.reduce((best, genre) => {
          const delta = (totals.get(genre) ?? 0) - (totals.get(best) ?? 0);
          if (delta !== 0) return delta < 0 ? genre : best;
          return genre.localeCompare(best, "tr") < 0 ? genre : best;
        });
      }

      const list = map.get(name) ?? [];
      list.push(item);
      map.set(name, list);
    }
    return map;
  };

  // Eşiğin altinda kalan satirlari kapat, yapimlarini yeniden dagit.
  // Kapatma islemi yalnizca tur kumesini kuculttugu icin dongu sonludur.
  let map = build();
  for (let pass = 0; pass <= totals.size; pass += 1) {
    const undersized = [...map.entries()].filter(
      ([name, list]) => name !== NO_GENRE_LABEL && list.length < minItems,
    );
    if (undersized.length === 0) break;
    for (const [name] of undersized) eligible.delete(name);
    map = build();
  }

  // Guvenlik agi: yine de esigin altinda kalan olursa yapimlari "Türsüz"e al
  // (hicbir yapim sayfadan dusmesin).
  const orphans: T[] = [];
  for (const [name, list] of [...map.entries()]) {
    if (name !== NO_GENRE_LABEL && list.length < minItems) {
      orphans.push(...list);
      map.delete(name);
    }
  }
  if (orphans.length > 0) {
    map.set(NO_GENRE_LABEL, [...(map.get(NO_GENRE_LABEL) ?? []), ...orphans]);
  }

  return [...map.entries()]
    .map(([name, groupItems]) => ({ name, items: groupItems }))
    .sort((a, b) => {
      if (a.name === NO_GENRE_LABEL) return 1;
      if (b.name === NO_GENRE_LABEL) return -1;
      return (
        b.items.length - a.items.length || a.name.localeCompare(b.name, "tr")
      );
    });
}
