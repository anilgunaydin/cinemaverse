import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { titleWatchProviders, watchProviders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const providers = await db
    .select({
      providerId: watchProviders.id,
      name: watchProviders.name,
      logoPath: watchProviders.logoPath,
      displayPriority: watchProviders.displayPriority,
      monetizationTypes: watchProviders.monetizationTypes,
      monetizationType: titleWatchProviders.monetizationType,
      link: titleWatchProviders.link,
      quality: titleWatchProviders.quality,
      region: titleWatchProviders.region,
      lastChecked: titleWatchProviders.lastChecked,
    })
    .from(titleWatchProviders)
    .innerJoin(watchProviders, eq(titleWatchProviders.providerId, watchProviders.id))
    .where(eq(titleWatchProviders.titleId, id))
    .orderBy(titleWatchProviders.monetizationType, watchProviders.displayPriority);

  // Grupla: monetizationType -> providers[]
  const grouped = providers.reduce((acc, p) => {
    const key = p.monetizationType;
    if (!acc[key]) acc[key] = [];
    acc[key].push({
      providerId: p.providerId,
      name: p.name,
      logoPath: p.logoPath,
      displayPriority: p.displayPriority,
      link: p.link,
      quality: p.quality,
      region: p.region,
      lastChecked: p.lastChecked,
    });
    return acc;
  }, {} as Record<string, any[]>);

  return NextResponse.json(grouped);
}