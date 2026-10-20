import { z } from "zod";

import { getCurrentUser, requireUser, UnauthorizedError } from "@/lib/auth/current-user";
import { createReport, listReports } from "@/lib/community/reports";
import { jsonError, jsonOk, parseJsonBody, rateLimit } from "@/lib/http";
import { createNotification } from "@/lib/notifications/service";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const REASON_LABELS: Record<string, string> = {
  spam: "Spam / İlgisiz",
  harassment: "Taciz / Rahatsız edici",
  hate_speech: "Nefret söylemi",
  sexual_content: "Cinsel içerik",
  violence: "Şiddet / Zarar verme",
  spoiler: "Spoiler (uyarısız)",
  misinformation: "Yanlış bilgi",
  copyright: "Telif hakkı ihlali",
  other: "Diğer",
};

const createReportSchema = z.object({
  targetType: z.enum(["review", "reply", "thread", "post", "user"]),
  targetId: z.string().trim().min(1),
  reason: z.enum([
    "spam",
    "harassment",
    "hate_speech",
    "sexual_content",
    "violence",
    "spoiler",
    "misinformation",
    "copyright",
    "other",
  ]),
  details: z.string().trim().max(2000).nullable().optional(),
});

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Giriş yapmalısınız.", 401, { code: "unauthorized" });

  const url = new URL(request.url);
  const status = url.searchParams.get("status") as "open" | "resolved" | "dismissed" | null;
  const isModerator = user.role === "admin" || user.role === "moderator";

  const items = await listReports({
    viewerId: user.id,
    isModerator,
    status: status ?? undefined,
    limit: 50,
  });
  return jsonOk({ items });
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return jsonError(error.message, 401, { code: "unauthorized" });
    }
    throw error;
  }

  const limit = rateLimit(`report:${user.id}`, 20, 60_000);
  if (!limit.allowed) {
    return jsonError("Çok sık rapor gönderiliyor.", 429, { code: "rate_limited" });
  }

  const parsed = await parseJsonBody(request, createReportSchema);
  if (!parsed.success) return parsed.response;

  // Kullanıcı kendini raporlayamaz
  if (parsed.data.targetType === "user" && parsed.data.targetId === user.id) {
    return jsonError("Kendinizi raporlayamazsınız.", 400, { code: "self_report" });
  }

  const result = await createReport(user.id, parsed.data);

  // Bildirim: moderatorlere ve adminlere "Yeni rapor"
  try {
    const db = getDb();
    const moderators = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "admin"));
    const adminRows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "moderator"));

    const reasonLabel = REASON_LABELS[parsed.data.reason] ?? parsed.data.reason;
    const targets = [...moderators, ...adminRows];
    await Promise.all(
      targets.map((m) =>
        createNotification({
          userId: m.id,
          type: "report",
          message: `Yeni rapor açıldı: ${reasonLabel}`,
          actorId: user.id,
          targetId: result.id,
          targetType: "report",
          deepLink: "/moderation",
        })
      )
    );
  } catch (e) {
    console.error("Report notification failed:", e);
  }

  return jsonOk({ reportId: result.id }, 201);
}