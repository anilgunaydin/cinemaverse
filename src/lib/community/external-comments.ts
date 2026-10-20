import "server-only";

import { desc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { externalComments } from "@/lib/db/schema";

export type ExternalComment = {
  id: string;
  source: string;
  sourceUrl: string | null;
  section: string | null;
  language: "tr" | "en" | "other";
  body: string;
};

/**
 * Title'a ait internet kaynakli yorumlar; yerli (tr) ve yabanci (en/diger)
 * olarak ayri dondurulur. UI'da iki ayri grupta gosterilir.
 */
export async function listExternalComments(
  titleId: string,
  limit = 60,
): Promise<{ local: ExternalComment[]; foreign: ExternalComment[]; total: number }> {
  const db = getDb();
  const rows = await db
    .select({
      id: externalComments.id,
      source: externalComments.source,
      sourceUrl: externalComments.sourceUrl,
      section: externalComments.section,
      language: externalComments.language,
      body: externalComments.body,
    })
    .from(externalComments)
    .where(eq(externalComments.titleId, titleId))
    .orderBy(desc(externalComments.createdAt))
    .limit(limit);

  const totalRows = await db
    .select({ id: externalComments.id })
    .from(externalComments)
    .where(eq(externalComments.titleId, titleId));

  const local = rows
    .filter((row) => row.language === "tr")
    .map(toView);
  const foreign = rows
    .filter((row) => row.language !== "tr")
    .map(toView);

  return { local, foreign, total: totalRows.length };
}

function toView(row: {
  id: string;
  source: string;
  sourceUrl: string | null;
  section: string | null;
  language: "tr" | "en" | "other";
  body: string;
}): ExternalComment {
  return {
    id: row.id,
    source: row.source,
    sourceUrl: row.sourceUrl,
    section: row.section,
    language: row.language,
    body: row.body,
  };
}
