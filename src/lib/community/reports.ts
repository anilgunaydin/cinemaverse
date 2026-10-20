import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import {
  discussionPosts,
  discussionThreads,
  reports,
  reviewReplies,
  reviews,
  users,
} from "@/lib/db/schema";
import { newId, nowIso, sanitizePlainText } from "@/lib/http";

export type ReportReason =
  | "spam"
  | "harassment"
  | "hate_speech"
  | "sexual_content"
  | "violence"
  | "spoiler"
  | "misinformation"
  | "copyright"
  | "other";

export type ReportTargetType = "review" | "reply" | "thread" | "post" | "user";

export type ReportInput = {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details?: string | null;
};

export type ReportView = {
  id: string;
  reporterId: string;
  reporterName: string;
  targetType: ReportTargetType;
  targetId: string;
  targetPreview: string;
  reason: ReportReason;
  details: string | null;
  status: "open" | "resolved" | "dismissed";
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
};

/** Yeni rapor oluştur. */
export async function createReport(
  reporterId: string,
  input: ReportInput,
): Promise<{ id: string }> {
  const db = getDb();
  const now = nowIso();
  const id = newId("rpt");
  const details = input.details
    ? sanitizePlainText(input.details).slice(0, 2000)
    : null;

  await db.insert(reports).values({
    id,
    reporterId,
    targetType: input.targetType,
    targetId: input.targetId,
    reason: input.reason,
    details,
    status: "open",
    createdAt: now,
  });

  return { id };
}

/** Rapor detayını getir (sadece moderatör/raporcu). */
export async function getReportDetail(
  reportId: string,
  viewerId: string,
  isModerator: boolean,
): Promise<ReportView | null> {
  const db = getDb();

  const rows = await db
    .select({ report: reports, reporterName: users.displayName })
    .from(reports)
    .innerJoin(users, eq(users.id, reports.reporterId))
    .where(eq(reports.id, reportId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (!isModerator && row.report.reporterId !== viewerId) return null;

  const targetPreview = await getTargetPreview(
    row.report.targetType,
    row.report.targetId,
  );

  return {
    id: row.report.id,
    reporterId: row.report.reporterId,
    reporterName: row.reporterName ?? "Kullanıcı",
    targetType: row.report.targetType,
    targetId: row.report.targetId,
    targetPreview,
    reason: row.report.reason as ReportReason,
    details: row.report.details,
    status: row.report.status,
    createdAt: row.report.createdAt,
    resolvedAt: null,
    resolvedBy: null,
  };
}

/** Raporları listele (moderator: hepsi; kullanıcı: kendi raporları). */
export async function listReports(options: {
  viewerId: string;
  isModerator: boolean;
  status?: "open" | "resolved" | "dismissed";
  limit?: number;
}): Promise<ReportView[]> {
  const db = getDb();
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);

  const whereClause = options.isModerator
    ? options.status
      ? eq(reports.status, options.status)
      : undefined
    : and(
        eq(reports.reporterId, options.viewerId),
        options.status ? eq(reports.status, options.status) : undefined,
      );

  const rows = await db
    .select({ report: reports, reporterName: users.displayName })
    .from(reports)
    .innerJoin(users, eq(users.id, reports.reporterId))
    .where(whereClause)
    .orderBy(desc(reports.createdAt))
    .limit(limit);

  const result: ReportView[] = [];
  for (const row of rows) {
    const targetPreview = await getTargetPreview(
      row.report.targetType,
      row.report.targetId,
    );
    result.push({
      id: row.report.id,
      reporterId: row.report.reporterId,
      reporterName: row.reporterName ?? "Kullanıcı",
      targetType: row.report.targetType,
      targetId: row.report.targetId,
      targetPreview,
      reason: row.report.reason as ReportReason,
      details: row.report.details,
      status: row.report.status,
      createdAt: row.report.createdAt,
      resolvedAt: null,
      resolvedBy: null,
    });
  }
  return result;
}

/** Rapor durumunu güncelle (moderator only). */
export async function resolveReport(
  moderatorId: string,
  reportId: string,
  status: "resolved" | "dismissed",
): Promise<{ ok: true } | { ok: false; reason: "not_found" }> {
  const db = getDb();

  const rows = await db
    .select({ id: reports.id })
    .from(reports)
    .where(eq(reports.id, reportId))
    .limit(1);

  if (!rows[0]) return { ok: false, reason: "not_found" };

  const now = nowIso();
  await db
    .update(reports)
    .set({ status, resolvedAt: now, resolvedBy: moderatorId })
    .where(eq(reports.id, reportId));

  return { ok: true };
}

/** Hedef içeriğin önizlemesini getir. */
async function getTargetPreview(
  targetType: ReportTargetType,
  targetId: string,
): Promise<string> {
  const db = getDb();

  switch (targetType) {
    case "review": {
      const rows = await db
        .select({ body: reviews.body })
        .from(reviews)
        .where(eq(reviews.id, targetId))
        .limit(1);
      return rows[0]?.body?.slice(0, 100) ?? "İçerik bulunamadı";
    }
    case "reply": {
      const rows = await db
        .select({ body: reviewReplies.body })
        .from(reviewReplies)
        .where(eq(reviewReplies.id, targetId))
        .limit(1);
      return rows[0]?.body?.slice(0, 100) ?? "İçerik bulunamadı";
    }
    case "thread": {
      const rows = await db
        .select({ heading: discussionThreads.heading, body: discussionThreads.body })
        .from(discussionThreads)
        .where(eq(discussionThreads.id, targetId))
        .limit(1);
      return rows[0]
        ? `${rows[0].heading}: ${rows[0].body.slice(0, 80)}`
        : "İçerik bulunamadı";
    }
    case "post": {
      const rows = await db
        .select({ body: discussionPosts.body })
        .from(discussionPosts)
        .where(eq(discussionPosts.id, targetId))
        .limit(1);
      return rows[0]?.body?.slice(0, 100) ?? "İçerik bulunamadı";
    }
    case "user": {
      const rows = await db
        .select({ displayName: users.displayName })
        .from(users)
        .where(eq(users.id, targetId))
        .limit(1);
      return rows[0] ? `Kullanıcı: ${rows[0].displayName}` : "Kullanıcı bulunamadı";
    }
    default:
      return "Bilinmeyen içerik türü";
  }
}

/** İçeriği moderasyon için gizle/ kaldır (moderator only). */
export async function moderateContent(
  moderatorId: string,
  targetType: ReportTargetType,
  targetId: string,
  action: "hide" | "remove" | "restore",
): Promise<{ ok: true } | { ok: false; reason: "not_found" }> {
  const db = getDb();

  const statusMap = {
    hide: "hidden",
    remove: "removed",
    restore: "visible",
  } as const;

  const newStatus = statusMap[action];
  const now = nowIso();

  switch (targetType) {
    case "review": {
      const result = await db
        .update(reviews)
        .set({ moderationStatus: newStatus, updatedAt: now })
        .where(eq(reviews.id, targetId));
      return result.changes > 0 ? { ok: true } : { ok: false, reason: "not_found" };
    }
    case "reply": {
      const result = await db
        .update(reviewReplies)
        .set({ moderationStatus: newStatus })
        .where(eq(reviewReplies.id, targetId));
      return result.changes > 0 ? { ok: true } : { ok: false, reason: "not_found" };
    }
    case "thread": {
      const result = await db
        .update(discussionThreads)
        .set({ moderationStatus: newStatus, updatedAt: now })
        .where(eq(discussionThreads.id, targetId));
      return result.changes > 0 ? { ok: true } : { ok: false, reason: "not_found" };
    }
    case "post": {
      const result = await db
        .update(discussionPosts)
        .set({ moderationStatus: newStatus })
        .where(eq(discussionPosts.id, targetId));
      return result.changes > 0 ? { ok: true } : { ok: false, reason: "not_found" };
    }
    case "user": {
      // Kullanıcı için henüz moderasyon durumu yok; gelecekte eklenebilir
      return { ok: false, reason: "not_found" };
    }
    default:
      return { ok: false, reason: "not_found" };
  }
}

/** Kullanıcının rapor sayısını getir. */
export async function getUserReportCount(userId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(reports)
    .where(eq(reports.reporterId, userId));
  return Number(rows[0]?.count ?? 0);
}

/** Açık rapor sayısını getir (moderator dashboard için). */
export async function getOpenReportsCount(): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(reports)
    .where(eq(reports.status, "open"));
  return Number(rows[0]?.count ?? 0);
}