import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { researchItems, researchSessions } from "@/lib/db/schema";
import { getTitleById } from "@/lib/catalog/service";
import { contentHash, newId, nowIso } from "@/lib/http";
import { getAiStatus, chat } from "@/lib/ai/provider";
import { fetchWikipediaSections, type ResearchSourceItem } from "./wikipedia-source";
import { fetchTmdbReviews, tmdbReviewsAvailable } from "./tmdb-source";

export type { ResearchSourceItem };

export class TitleNotFoundError extends Error {}

async function collectSources(input: {
  originalTitle: string;
  localizedTitle: string | null;
  kind: string;
  tmdbId: string | null;
}): Promise<ResearchSourceItem[]> {
  const collected: ResearchSourceItem[] = [];

  // 1) Wikipedia (ucretsiz, anahtarsiz). Once Ingilizce tam baslik, sonra
  //    varsa Turkce yerel baslik denenir.
  const english = await fetchWikipediaSections(input.originalTitle, "en");
  if (english) collected.push(...english.items);

  if (input.localizedTitle && input.localizedTitle !== input.originalTitle) {
    const turkish = await fetchWikipediaSections(input.localizedTitle, "tr");
    if (turkish) collected.push(...turkish.items);
  }

  // 2) TMDB kullanici incelemeleri (yalnizca anahtar varsa).
  if (tmdbReviewsAvailable() && input.tmdbId) {
    const kind = input.kind === "series" ? "series" : "movie";
    const reviews = await fetchTmdbReviews(input.tmdbId, kind);
    collected.push(...reviews);
  }

  // Ayni metin birden fazla kaynaktan/bolumden gelebilir: icerik hash'i ile tekle.
  const seen = new Set<string>();
  const unique: ResearchSourceItem[] = [];
  for (const item of collected) {
    const key = contentHash(item.sourceUrl, item.excerpt);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  return unique;
}

export type ResearchOutcome = {
  sessionId: string;
  status: "completed" | "partial" | "failed";
  sourceCount: number;
  aiSummary: { generated: boolean; provider: string | null; reason: string | null };
  items: ResearchSourceItem[];
};

/**
 * Bir yapim icin kaynak temelli arastirma calistirir.
 *
 * - Yalnizca gercek kaynaklardan (Wikipedia, opsiyonel TMDB) alinti toplar.
 * - Kaynak bulunamazsa bunu ACIKCA belirtir; sahte sonuc uretmez.
 * - AI ozeti yalnizca saglayici etkinse ve isteginde istenmisse uretilir;
 *   her zaman "AI tarafindan uretildi" olarak isaretlenir.
 */
export async function runResearch(
  userId: string,
  titleId: string,
  options: { question?: string; withAiSummary?: boolean } = {},
): Promise<ResearchOutcome> {
  const title = await getTitleById(titleId);
  if (!title) throw new TitleNotFoundError("Yapım bulunamadı.");

  const db = getDb();
  const now = nowIso();
  const sessionId = newId("rsr");

  await db.insert(researchSessions).values({
    id: sessionId,
    userId,
    titleId,
    question: options.question?.trim().slice(0, 500) ?? null,
    status: "running",
    sourceCount: 0,
    createdAt: now,
  });

  let items: ResearchSourceItem[] = [];
  let failure: string | null = null;

  try {
    items = await collectSources({
      originalTitle: title.originalTitle,
      localizedTitle: title.localizedTitle,
      kind: title.kind,
      tmdbId: title.tmdbId,
    });
  } catch (error) {
    failure = error instanceof Error ? error.message : "Kaynak toplanamadı.";
  }

  // Kayitlari yaz (sessionId + contentHash ile tekil).
  if (items.length > 0) {
    await db
      .insert(researchItems)
      .values(
        items.map((item) => ({
          id: newId("rit"),
          sessionId,
          titleId,
          sourceName: item.sourceName,
          sourceUrl: item.sourceUrl,
          contentHash: contentHash(item.sourceUrl, item.excerpt),
          heading: item.heading,
          excerpt: item.excerpt,
          author: item.author,
          publishedAt: item.publishedAt,
          fetchedAt: now,
          spoilerRisk: item.spoilerRisk,
          licenseNote: item.licenseNote,
        })),
      )
      .onConflictDoNothing();
  }

  // AI ozeti (yalnizca isteginde ve saglayici aciksa).
  let aiSummary: ResearchOutcome["aiSummary"] = {
    generated: false,
    provider: null,
    reason: null,
  };
  const aiStatus = getAiStatus();
  let summary: string | null = null;

  if (options.withAiSummary && items.length > 0) {
    if (!aiStatus.enabled) {
      aiSummary.reason = aiStatus.reason;
    } else {
      const sourceBlock = items
        .slice(0, 8)
        .map(
          (item, index) =>
            `[${index + 1}] ${item.sourceName} — ${item.heading ?? "bölüm"}\n${item.excerpt}`,
        )
        .join("\n\n");

      const result = await chat(
        [
          {
            role: "system",
            content:
              "Sen bir sinema araştırma asistanısın. Yalnızca sana verilen kaynak " +
              "alıntılarına dayanarak Türkçe, tarafsız ve kısa bir özet yaz. " +
              "Kaynaklarda olmayan hiçbir bilgiyi uydurma. Her iddiadan sonra " +
              "kaynağı [1] gibi köşeli parantezle belirt. Emin olmadığın noktayı " +
              "açıkça 'kaynaklarda belirsiz' diye yaz.",
          },
          {
            role: "user",
            content:
              `Yapım: ${title.localizedTitle ?? title.originalTitle} (${title.releaseYear ?? "yıl bilinmiyor"})\n` +
              (options.question ? `Kullanıcı sorusu: ${options.question}\n` : "") +
              `\nKaynak alıntıları:\n${sourceBlock}`,
          },
        ],
        { temperature: 0.3, maxTokens: 600 },
      );

      if (result.ok) {
        summary = result.content;
        aiSummary = {
          generated: true,
          provider: result.provider,
          reason: null,
        };
      } else {
        aiSummary.reason = result.message;
      }
    }
  } else if (options.withAiSummary && items.length === 0) {
    aiSummary.reason = "Özetlenecek kaynak bulunamadı.";
  }

  const status: ResearchOutcome["status"] =
    failure !== null
      ? "failed"
      : items.length === 0
        ? "partial"
        : "completed";

  await db
    .update(researchSessions)
    .set({
      status,
      sourceCount: items.length,
      summary,
      summaryGeneratedByAi: aiSummary.generated,
      error:
        failure ??
        (items.length === 0
          ? "Kaynaklarda değerlendirme/alımlama bölümü bulunamadı."
          : null),
      completedAt: nowIso(),
    })
    .where(eq(researchSessions.id, sessionId));

  return { sessionId, status, sourceCount: items.length, aiSummary, items };
}

export type ResearchSessionView = {
  sessionId: string;
  question: string | null;
  status: string;
  summary: string | null;
  summaryGeneratedByAi: boolean;
  sourceCount: number;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
  items: (ResearchSourceItem & { id: string })[];
};

export async function listResearchSessions(
  userId: string,
  titleId?: string,
): Promise<Omit<ResearchSessionView, "items">[]> {
  const db = getDb();
  const conditions = [eq(researchSessions.userId, userId)];
  if (titleId) conditions.push(eq(researchSessions.titleId, titleId));

  const rows = await db
    .select()
    .from(researchSessions)
    .where(and(...conditions))
    .orderBy(desc(researchSessions.createdAt))
    .limit(20);

  return rows.map((row) => ({
    sessionId: row.id,
    question: row.question,
    status: row.status,
    summary: row.summary,
    summaryGeneratedByAi: row.summaryGeneratedByAi,
    sourceCount: row.sourceCount,
    error: row.error,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  }));
}

export async function getResearchSession(
  userId: string,
  sessionId: string,
): Promise<ResearchSessionView | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(researchSessions)
    .where(
      and(
        eq(researchSessions.id, sessionId),
        eq(researchSessions.userId, userId),
      ),
    )
    .limit(1);

  const session = rows[0];
  if (!session) return null;

  const itemRows = await db
    .select()
    .from(researchItems)
    .where(eq(researchItems.sessionId, sessionId));

  return {
    sessionId: session.id,
    question: session.question,
    status: session.status,
    summary: session.summary,
    summaryGeneratedByAi: session.summaryGeneratedByAi,
    sourceCount: session.sourceCount,
    error: session.error,
    createdAt: session.createdAt,
    completedAt: session.completedAt,
    items: itemRows.map((item) => ({
      id: item.id,
      sourceName: item.sourceName,
      sourceUrl: item.sourceUrl,
      heading: item.heading,
      excerpt: item.excerpt ?? "",
      author: item.author,
      publishedAt: item.publishedAt,
      licenseNote: item.licenseNote ?? "",
      spoilerRisk: item.spoilerRisk,
    })),
  };
}
