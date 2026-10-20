import "server-only";

import { getDb } from "@/lib/db";
import { notifications, pushSubscriptions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

export type NotificationType =
  | "follow"
  | "review"
  | "review_reply"
  | "report"
  | "mention"
  | "system";

export type NotificationTargetType =
  | "user"
  | "review"
  | "reply"
  | "report"
  | "title"
  | "thread"
  | "post";

/**
 * Kullaniciya bildirim olusturur ve varsa Web Push gonderir.
 * Hatalar yutulur: bildirim gonderilemese bile ana islem basarisiz olmamalidir.
 */
export async function createNotification(input: {
  userId: string;
  type: NotificationType;
  message: string;
  actorId?: string | null;
  targetId?: string | null;
  targetType?: NotificationTargetType | null;
  deepLink?: string | null;
}): Promise<void> {
  try {
    const db = getDb();

    await db.insert(notifications).values({
      id: `ntf_${randomUUID().replace(/-/g, "").slice(0, 20)}`,
      userId: input.userId,
      type: input.type,
      message: input.message,
      actorId: input.actorId ?? null,
      targetId: input.targetId ?? null,
      targetType: input.targetType ?? null,
      deepLink: input.deepLink ?? null,
      isRead: false,
    });

    // Web Push gonder (varsa)
    await sendPushNotification(input.userId, input.message, input.deepLink ?? "/");
  } catch (e) {
    console.error("createNotification failed:", e);
  }
}

async function sendPushNotification(
  userId: string,
  body: string,
  url: string
): Promise<void> {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) return;

  try {
    const db = getDb();
    const subs = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));

    if (subs.length === 0) return;

    const webPush = (await import("web-push")).default;
    webPush.setVapidDetails(subject, publicKey, privateKey);

    const payload = JSON.stringify({
      title: "CinemaVerse",
      body,
      url,
      actions: [{ action: "open", title: "Aç" }],
    });

    for (const sub of subs) {
      try {
        await webPush.sendNotification(
          JSON.parse(sub.subscriptionJson),
          payload
        );
      } catch (e: any) {
        // Abonelik sona ermis olabilir (410/404) -> sil
        if (e.statusCode === 410 || e.statusCode === 404) {
          await db
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.id, sub.id));
        }
      }
    }
  } catch (e) {
    console.error("sendPushNotification failed:", e);
  }
}

/** Kullaniciyi takip edenlere toplu bildirim. */
export async function notifyFollowers(
  followerIds: string[],
  message: string,
  deepLink: string,
  type: NotificationType = "system"
): Promise<void> {
  await Promise.all(
    followerIds.map((userId) =>
      createNotification({ userId, type, message, deepLink })
    )
  );
}
