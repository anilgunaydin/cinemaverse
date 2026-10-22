/**
 * Katalogdaki yapimlari turlerine gore satirlara ayirir (saf fonksiyon).
 *
 * - Bir yapim, sahip oldugu her turde gorunur (Netflix tarzi satirlar).
 * - Turu olmayan yapimlar "Türsüz" satirina duser.
 * - Satirlar kalabaliktan aza siralanir; "Türsüz" her zaman en sonda.
 * - `minItems`: bu sayidan az yapimi olan turler satir olmaz (tek tuk
 *   etiketler sayfayi yuzlerce satira cevirmesin diye).
 */
export type GenreGroup<T> = { name: string; items: T[] };

export const NO_GENRE_LABEL = "Türsüz";

export function groupByGenre<T extends { genres: string[] }>(
  items: T[],
  options: { minItems?: number } = {},
): GenreGroup<T>[] {
  const minItems = options.minItems ?? 1;
  const map = new Map<string, T[]>();

  for (const item of items) {
    const names = item.genres.length > 0 ? item.genres : [NO_GENRE_LABEL];
    for (const name of new Set(names)) {
      const list = map.get(name) ?? [];
      list.push(item);
      map.set(name, list);
    }
  }

  return [...map.entries()]
    .map(([name, groupItems]) => ({ name, items: groupItems }))
    .filter(
      (group) => group.name === NO_GENRE_LABEL || group.items.length >= minItems,
    )
    .sort((a, b) => {
      if (a.name === NO_GENRE_LABEL) return 1;
      if (b.name === NO_GENRE_LABEL) return -1;
      return (
        b.items.length - a.items.length || a.name.localeCompare(b.name, "tr")
      );
    });
}
