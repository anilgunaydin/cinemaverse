import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { subscription, userAgent } = body;

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }

    const db = getDb();

    // Upsert: delete existing with same endpoint, insert new
    await db
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, user.id));

    await db.insert(pushSubscriptions).values({
      id: randomUUID(),
      userId: user.id,
      subscriptionJson: JSON.stringify(subscription),
      userAgent: userAgent ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Push subscribe error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint required" }, { status: 400 });
    }

    const db = getDb();
    const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, user.id));

    // Find and delete matching endpoint
    for (const sub of subs) {
      const subData = JSON.parse(sub.subscriptionJson);
      if (subData.endpoint === endpoint) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
        break;
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Push unsubscribe error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}