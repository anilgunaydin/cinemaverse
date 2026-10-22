import { describe, expect, it } from "vitest";

import { groupByGenre, NO_GENRE_LABEL } from "@/lib/catalog/genre-groups";

const item = (id: string, genres: string[]) => ({ id, genres });

const allIds = <T extends { id: string }>(groups: { items: T[] }[]) =>
  groups.flatMap((group) => group.items.map((entry) => entry.id));

describe("groupByGenre", () => {
  it("her yapımı yalnızca tek bir tür satırında gösterir", () => {
    const groups = groupByGenre([
      item("a", ["Dram", "Suç"]),
      item("b", ["Dram"]),
    ]);

    // a en özgül türü olan Suç'a, b tek türü olan Dram'a gider.
    expect(groups.map((group) => group.name)).toEqual(["Dram", "Suç"]);
    expect(groups[0].items.map((entry) => entry.id)).toEqual(["b"]);
    expect(groups[1].items.map((entry) => entry.id)).toEqual(["a"]);

    // Hiçbir yapım iki kez listelenmez.
    const ids = allIds(groups);
    expect(ids).toHaveLength(new Set(ids).size);
  });

  it("türü olmayanları 'Türsüz' satırına koyar ve en sona atar", () => {
    const groups = groupByGenre([
      item("a", []),
      item("b", ["Dram"]),
      item("c", ["Dram"]),
    ]);

    expect(groups.at(-1)?.name).toBe(NO_GENRE_LABEL);
    expect(groups.at(-1)?.items.map((entry) => entry.id)).toEqual(["a"]);
  });

  it("kalabalık satırları önce sıralar", () => {
    const groups = groupByGenre([
      item("a", ["Dram"]),
      item("b", ["Komedi"]),
      item("c", ["Komedi"]),
      item("d", ["Komedi"]),
    ]);

    expect(groups.map((group) => group.name)).toEqual(["Komedi", "Dram"]);
  });

  it("aynı türü iki kez yazsa da yapımı bir kez ekler", () => {
    const groups = groupByGenre([item("a", ["Dram", "Dram"])]);

    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(1);
  });

  it("eşik altındaki tür kapanınca yapımlar kaybolmaz, uygun türe geçer", () => {
    const groups = groupByGenre(
      [
        item("a", ["Dram", "Suç"]),
        item("b", ["Dram", "Suç"]),
        item("c", ["Dram", "Suç"]),
        item("d", ["Komedi"]),
        item("e", ["Komedi"]),
        item("f", ["Komedi"]),
        item("g", ["Komedi"]),
        item("h", ["Dram"]),
      ],
      { minItems: 4 },
    );

    // Suç (3) eşiğin altında kalır; Suç yapımları Dram'a geçer.
    expect(groups.map((group) => group.name)).toEqual(["Dram", "Komedi"]);
    expect(allIds(groups).sort()).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
      "g",
      "h",
    ]);
  });

  it("boş listede boş sonuç döner", () => {
    expect(groupByGenre([])).toEqual([]);
  });
});
