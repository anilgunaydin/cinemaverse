import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getFullProfile, saveExplicitPreferences } from "@/lib/preference/engine";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const profile = await getFullProfile(user.id);
    return NextResponse.json(profile);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const prefs = await req.json();

    // Validation
    const required = ["tempo", "realism", "rewatch", "spoilerTolerance", "socialWeight"];
    for (const field of required) {
      if (prefs[field] === undefined) {
        return NextResponse.json({ error: `Missing field: ${field}` }, { status: 400 });
      }
    }

    // Validate ranges
    if (prefs.tempo < 1 || prefs.tempo > 10) {
      return NextResponse.json({ error: "tempo must be 1-10" }, { status: 400 });
    }
    if (prefs.realism < 1 || prefs.realism > 10) {
      return NextResponse.json({ error: "realism must be 1-10" }, { status: 400 });
    }
    if (prefs.socialWeight < 1 || prefs.socialWeight > 10) {
      return NextResponse.json({ error: "socialWeight must be 1-10" }, { status: 400 });
    }
    if (!["nadir", "bazen", "siklik"].includes(prefs.rewatch)) {
      return NextResponse.json({ error: "invalid rewatch value" }, { status: 400 });
    }
    if (!["yok", "az", "onemsiz"].includes(prefs.spoilerTolerance)) {
      return NextResponse.json({ error: "invalid spoilerTolerance value" }, { status: 400 });
    }

    await saveExplicitPreferences(user.id, prefs);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}