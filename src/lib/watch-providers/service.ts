import "server-only";

import { getDb } from "@/lib/db";
import { titleWatchProviders, watchProviders } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

export type WatchProviderEntry = {
  providerId: number;
  name: string;
  logoPath: string | null;
  displayPriority: number;
  monetizationType: "flatrate" | "rent" | "buy" | "free" | "ads";
  link: string | null;
  quality: string | null;
  region: string;
};

export const MONETIZATION_LABELS: Record<
  WatchProviderEntry["monetizationType"],
  { label: string; short: string; icon: string }
> = {
  flatrate: { label: "Abonelikle", short: "Abone", icon: "📺" },
  rent: { label: "Kiralama", short: "Kirala", icon: "💰" },
  buy: { label: "Satın Al", short: "Satın al", icon: "🛒" },
  free: { label: "Ücretsiz", short: "Ücretsiz", icon: "🆓" },
  ads: { label: "Reklamlı", short: "Reklamlı", icon: "🎞️" },
};

export const MONETIZATION_ORDER: WatchProviderEntry["monetizationType"][] = [
  "flatrate",
  "rent",
  "buy",
  "free",
  "ads",
];

/** Bir yapim icin TR bolgesindeki yayin platformlarini dondurur. */
export async function getWatchProviders(
  titleId: string
): Promise<WatchProviderEntry[]> {
  const db = getDb();

  const rows = await db
    .select({
      providerId: watchProviders.id,
      name: watchProviders.name,
      logoPath: watchProviders.logoPath,
      displayPriority: watchProviders.displayPriority,
      monetizationType: titleWatchProviders.monetizationType,
      link: titleWatchProviders.link,
      quality: titleWatchProviders.quality,
      region: titleWatchProviders.region,
    })
    .from(titleWatchProviders)
    .innerJoin(watchProviders, eq(titleWatchProviders.providerId, watchProviders.id))
    .where(eq(titleWatchProviders.titleId, titleId))
    .orderBy(asc(titleWatchProviders.monetizationType), asc(watchProviders.displayPriority));

  return rows as WatchProviderEntry[];
}

/** Platformlari turlerine gore gruplar. */
export function groupWatchProviders(
  providers: WatchProviderEntry[]
): Record<string, WatchProviderEntry[]> {
  const grouped: Record<string, WatchProviderEntry[]> = {};
  for (const provider of providers) {
    const key = provider.monetizationType;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(provider);
  }
  return grouped;
}
