import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import webPush from "web-push";

/**
 * VAPID ayarlari build-time'da degil, istek aninda yapilir.
 * Boylece CI/build ortaminda VAPID_KEY olmasa da build kirilmaz.
 */
function configureVapid(): { ok: true } | { ok: false; error: string } {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    return { ok: false, error: "VAPID keys yapılandırılmamış." };
  }

  try {
    webPush.setVapidDetails(subject, publicKey, privateKey);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only admin can send notifications
  if (user.role !== "admin" && user.role !== "moderator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const vapid = configureVapid();
  if (!vapid.ok) {
    return NextResponse.json({ error: vapid.error }, { status: 503 });
  }

  try {
    const body = await req.json();
    const { userId, title, body: bodyText, url, actions } = body;

    if (!userId || !title || !bodyText) {
      return NextResponse.json({ error: "userId, title, body required" }, { status: 400 });
    }

    const db = getDb();
    const subs = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));

    if (subs.length === 0) {
      return NextResponse.json({ error: "No subscriptions for user" }, { status: 404 });
    }

    const payload = JSON.stringify({
      title,
      body: bodyText,
      url: url ?? "/",
      actions: actions ?? [{ action: "open", title: "Aç" }],
    });

    let sent = 0;
    let failed = 0;

    for (const sub of subs) {
      const subscription = JSON.parse(sub.subscriptionJson);
      try {
        await webPush.sendNotification(subscription, payload);
        sent++;
      } catch (e: any) {
        // If 410/404, subscription expired -> delete
        if (e.statusCode === 410 || e.statusCode === 404) {
          await getDb()
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.id, sub.id));
        }
        failed++;
      }
    }

    return NextResponse.json({ sent, failed, total: subs.length });
  } catch (e: any) {
    console.error("Push send error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}