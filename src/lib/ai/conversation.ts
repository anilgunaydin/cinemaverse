import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { aiConversations, aiMessages, libraryEntries } from "@/lib/db/schema";
import { getTitleById } from "@/lib/catalog/service";
import { newId, nowIso, sanitizePlainText } from "@/lib/http";
import { chat, getAiStatus, type ChatMessage } from "./provider";
import { buildSystemPrompt, type ChatSpoilerMode } from "./prompt";

export type AiConversationView = {
  id: string;
  titleId: string | null;
  heading: string;
  spoilerMode: ChatSpoilerMode;
  spoilerSeason: number | null;
  provider: string | null;
  model: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiMessageView = {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  provider: string | null;
  model: string | null;
  createdAt: string;
};

export async function createConversation(
  userId: string,
  input: {
    titleId?: string | null;
    heading: string;
    spoilerMode?: ChatSpoilerMode;
    spoilerSeason?: number | null;
  },
): Promise<AiConversationView> {
  const db = getDb();
  const now = nowIso();
  const id = newId("cnv");

  const heading = sanitizePlainText(input.heading).slice(0, 200) || "Yeni tartışma";
  const status = getAiStatus();

  await db.insert(aiConversations).values({
    id,
    userId,
    titleId: input.titleId ?? null,
    heading,
    spoilerMode: input.spoilerMode ?? "progress",
    spoilerSeason: input.spoilerSeason ?? null,
    provider: status.enabled ? status.provider : null,
    model: status.enabled ? status.model : null,
    createdAt: now,
    updatedAt: now,
  });

  return {
    id,
    titleId: input.titleId ?? null,
    heading,
    spoilerMode: input.spoilerMode ?? "progress",
    spoilerSeason: input.spoilerSeason ?? null,
    provider: status.enabled ? status.provider : null,
    model: status.enabled ? status.model : null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function listConversations(
  userId: string,
  titleId?: string,
): Promise<AiConversationView[]> {
  const db = getDb();
  const conditions = [eq(aiConversations.userId, userId)];
  if (titleId) conditions.push(eq(aiConversations.titleId, titleId));

  const rows = await db
    .select()
    .from(aiConversations)
    .where(and(...conditions))
    .orderBy(desc(aiConversations.updatedAt))
    .limit(50);

  return rows.map((row) => ({
    id: row.id,
    titleId: row.titleId,
    heading: row.heading,
    spoilerMode: row.spoilerMode,
    spoilerSeason: row.spoilerSeason,
    provider: row.provider,
    model: row.model,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

export async function getConversationMessages(
  userId: string,
  conversationId: string,
): Promise<{ conversation: AiConversationView; messages: AiMessageView[] } | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(aiConversations)
    .where(
      and(
        eq(aiConversations.id, conversationId),
        eq(aiConversations.userId, userId),
      ),
    )
    .limit(1);

  const conversation = rows[0];
  if (!conversation) return null;

  const messageRows = await db
    .select()
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId))
    .orderBy(asc(aiMessages.createdAt))
    .limit(200);

  return {
    conversation: {
      id: conversation.id,
      titleId: conversation.titleId,
      heading: conversation.heading,
      spoilerMode: conversation.spoilerMode,
      spoilerSeason: conversation.spoilerSeason,
      provider: conversation.provider,
      model: conversation.model,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    },
    messages: messageRows.map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      provider: row.provider,
      model: row.model,
      createdAt: row.createdAt,
    })),
  };
}

export async function deleteConversation(
  userId: string,
  conversationId: string,
): Promise<boolean> {
  const db = getDb();
  const owned = await db
    .select({ id: aiConversations.id })
    .from(aiConversations)
    .where(
      and(
        eq(aiConversations.id, conversationId),
        eq(aiConversations.userId, userId),
      ),
    )
    .limit(1);
  if (!owned[0]) return false;

  await db.delete(aiMessages).where(eq(aiMessages.conversationId, conversationId));
  await db
    .delete(aiConversations)
    .where(eq(aiConversations.id, conversationId));
  return true;
}

export type SendMessageResult =
  | { ok: true; userMessage: AiMessageView; assistantMessage: AiMessageView }
  | { ok: false; reason: "disabled" | "not_found" | "error"; message: string };

/**
 * Kullanici mesajini kaydeder, AI yanitini uretir ve kaydeder.
 *
 * AI saglayici KAPALIYSA hicbir mesaj kaydedilmez ve acik bir hata doner;
 * boylece kullanici yanitsiz bir mesaj birikimi ile karsilasmaz.
 */
export async function sendMessage(
  userId: string,
  conversationId: string,
  rawContent: string,
): Promise<SendMessageResult> {
  const status = getAiStatus();
  if (!status.enabled || !status.model || status.provider === "none") {
    return { ok: false, reason: "disabled", message: status.reason };
  }

  const existing = await getConversationMessages(userId, conversationId);
  if (!existing) {
    return { ok: false, reason: "not_found", message: "Tartışma bulunamadı." };
  }

  const content = sanitizePlainText(rawContent).slice(0, 4000);
  if (content.length === 0) {
    return { ok: false, reason: "error", message: "Mesaj boş olamaz." };
  }

  const db = getDb();
  const now = nowIso();

  const userMessageId = newId("msg");
  await db.insert(aiMessages).values({
    id: userMessageId,
    conversationId,
    role: "user",
    content,
    provider: null,
    model: null,
    createdAt: now,
  });

  // Prompt icin yapim bilgisi ve ilerleme.
  let titleName = existing.conversation.heading;
  let kind = "movie";
  let year: number | null = null;
  let spoilerSeason = existing.conversation.spoilerSeason;

  if (existing.conversation.titleId) {
    const title = await getTitleById(existing.conversation.titleId);
    if (title) {
      titleName = title.localizedTitle ?? title.originalTitle;
      kind = title.kind;
      year = title.releaseYear;

      if (existing.conversation.spoilerMode === "progress") {
        const entry = await db
          .select({ progressSeason: libraryEntries.progressSeason })
          .from(libraryEntries)
          .where(
            and(
              eq(libraryEntries.userId, userId),
              eq(libraryEntries.titleId, existing.conversation.titleId),
            ),
          )
          .limit(1);
        spoilerSeason = entry[0]?.progressSeason ?? null;
      }
    }
  }

  const systemPrompt = buildSystemPrompt({
    titleName,
    kind,
    year,
    spoilerMode: existing.conversation.spoilerMode,
    spoilerSeason,
  });

  const history: ChatMessage[] = existing.messages
    .slice(-12)
    .map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content,
    }));

  const result = await chat([
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content },
  ]);

  if (!result.ok) {
    return { ok: false, reason: "error", message: result.message };
  }

  const assistantNow = nowIso();
  const assistantMessageId = newId("msg");
  await db.insert(aiMessages).values({
    id: assistantMessageId,
    conversationId,
    role: "assistant",
    content: result.content,
    provider: result.provider,
    model: result.model,
    createdAt: assistantNow,
  });

  await db
    .update(aiConversations)
    .set({
      provider: result.provider,
      model: result.model,
      updatedAt: assistantNow,
    })
    .where(eq(aiConversations.id, conversationId));

  return {
    ok: true,
    userMessage: {
      id: userMessageId,
      role: "user",
      content,
      provider: null,
      model: null,
      createdAt: now,
    },
    assistantMessage: {
      id: assistantMessageId,
      role: "assistant",
      content: result.content,
      provider: result.provider,
      model: result.model,
      createdAt: assistantNow,
    },
  };
}
