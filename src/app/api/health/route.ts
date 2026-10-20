import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";

export async function GET() {
  try {
    const { sqlite } = getDatabase();
    sqlite.prepare("SELECT 1").get();
    return NextResponse.json({ ok: true, db: "connected", ts: new Date().toISOString() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}