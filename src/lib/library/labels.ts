import type { WatchStatus } from "@/lib/db/schema";

/**
 * Istemci bilesenleri "server-only" modulunu import edemez.
 * Bu yuzden etiketler ayri, saf bir modulde tutulur.
 */
export const WATCH_STATUS_LABELS: Record<WatchStatus, string> = {
  watched: "İzledim",
  not_watched: "İzlemedim",
  watching: "İzliyorum",
  dropped: "Yarım bıraktım",
  watchlist: "İzleme listemde",
  unsure: "Emin değilim",
};

export const REWATCH_LABELS: Record<string, string> = {
  yes: "Evet",
  maybe: "Belki",
  no: "Hayır",
};
