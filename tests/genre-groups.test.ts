import { describe, expect, it } from "vitest";

import { groupByGenre, NO_GENRE_LABEL } from "@/lib/catalog/genre-groups";

const item = (id: string, genres: string[]) => ({ id, genres });

describe("groupByGenre", () => {
  it("her yapımı sahip olduğu her türde gösterir", () => {
    const groups = groupByGenre([
      item("a", ["Dram", "Suç"]),
      item("b", ["Dram"]),
    ]);

    expect(groups.map((group) => group.name)).toEqual(["Dram", "Suç"]);
    expect(groups[0].items.map((entry) => entry.id)).toEqual(["a", "b"]);
    expect(groups[1].items.map((entry) => entry.id)).toEqual(["a"]);
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

  it("boş listede boş sonuç döner", () => {
    expect(groupByGenre([])).toEqual([]);
  });
});
