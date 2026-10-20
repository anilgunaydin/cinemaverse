/**
 * Topluluk icerigi (konu/yanit/inceleme) erisim kurallari — saf fonksiyonlar.
 *
 * Bu kurallar guvenlikle ilgilidir; hicbir tahmin yapilmaz ve varsayilan
 * davranis her zaman "gosterme" yonundedir.
 */

export type ContentVisibility = "private" | "followers" | "public";
export type ModerationStatus = "visible" | "hidden" | "removed";

export type VisibilitySubject = {
  userId: string;
  visibility: ContentVisibility;
  moderationStatus: ModerationStatus;
};

/**
 * Temel kural (takipci kontrolu YOK):
 *  - "removed" hicbir zaman gosterilmez.
 *  - "hidden" yalnizca yazar tarafindan gorulur.
 *  - "public" herkese aciktir.
 *  - "private" yalnizca yazar tarafindan gorulur.
 *  - "followers" takipci kontrolu yapilmadan yalnizca yazar icin aciktir.
 */
export function isContentVisibleTo(
  subject: VisibilitySubject,
  viewerId: string | null | undefined,
): boolean {
  if (subject.moderationStatus === "removed") return false;

  const isAuthor = viewerId != null && viewerId === subject.userId;
  if (subject.moderationStatus === "hidden") return isAuthor;
  if (subject.visibility === "public") return true;
  return isAuthor;
}

/**
 * Takipci-aware kural: "followers" gorunurlugu icin takip iliskisi kontrol eder.
 * Bu fonksiyon asenkron oldugu icin sadece server-side cagrilmalidir.
 */
export async function isContentVisibleToWithFollowers(
  subject: VisibilitySubject,
  viewerId: string | null | undefined,
  checkFollower: (viewerId: string, authorId: string) => Promise<boolean>,
): Promise<boolean> {
  if (subject.moderationStatus === "removed") return false;

  const isAuthor = viewerId != null && viewerId === subject.userId;
  if (subject.moderationStatus === "hidden") return isAuthor;
  if (subject.visibility === "public") return true;
  if (subject.visibility === "private") return isAuthor;

  // followers: takip ediyorsa gorur, yazarsa da gorur
  if (subject.visibility === "followers") {
    if (isAuthor) return true;
    if (!viewerId) return false;
    return checkFollower(viewerId, subject.userId);
  }

  return isAuthor;
}
