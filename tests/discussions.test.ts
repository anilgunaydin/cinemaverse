import { describe, expect, it } from "vitest";

import { isContentVisibleTo } from "@/lib/community/access";

const author = "usr_author";
const other = "usr_other";

describe("isContentVisibleTo", () => {
  it("herkese acik ve gorunur icerik herkes tarafindan gorulur", () => {
    expect(
      isContentVisibleTo(
        { userId: author, visibility: "public", moderationStatus: "visible" },
        other,
      ),
    ).toBe(true);
    expect(
      isContentVisibleTo(
        { userId: author, visibility: "public", moderationStatus: "visible" },
        null,
      ),
    ).toBe(true);
  });

  it("ozel icerik yalnizca yazar tarafindan gorulur", () => {
    const subject = {
      userId: author,
      visibility: "private",
      moderationStatus: "visible",
    } as const;
    expect(isContentVisibleTo(subject, author)).toBe(true);
    expect(isContentVisibleTo(subject, other)).toBe(false);
    expect(isContentVisibleTo(subject, null)).toBe(false);
  });

  it("takipci gorunurlugu takip sistemi gelene kadar yalnizca yazar icin aciktir", () => {
    const subject = {
      userId: author,
      visibility: "followers",
      moderationStatus: "visible",
    } as const;
    expect(isContentVisibleTo(subject, author)).toBe(true);
    expect(isContentVisibleTo(subject, other)).toBe(false);
  });

  it("gizlenen icerik yalnizca yazar tarafindan gorulur", () => {
    const subject = {
      userId: author,
      visibility: "public",
      moderationStatus: "hidden",
    } as const;
    expect(isContentVisibleTo(subject, author)).toBe(true);
    expect(isContentVisibleTo(subject, other)).toBe(false);
    expect(isContentVisibleTo(subject, null)).toBe(false);
  });

  it("kaldirilan icerik hic kimse tarafindan gorulmez (yazar dahil)", () => {
    const subject = {
      userId: author,
      visibility: "public",
      moderationStatus: "removed",
    } as const;
    expect(isContentVisibleTo(subject, author)).toBe(false);
    expect(isContentVisibleTo(subject, other)).toBe(false);
  });
});
