import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { sqlite } = getDatabase();

    // Use raw SQL with the underlying sqlite instance
    const rows = sqlite.prepare(`
      SELECT twp.provider_id as providerId, 
             wp.name, 
             wp.logo_path as logoPath, 
             wp.display_priority as displayPriority,
             twp.monetization_type as monetizationType,
             twp.link, 
             twp.quality, 
             twp.region, 
             twp.last_checked as lastChecked
      FROM title_watch_providers twp
      INNER JOIN watch_providers wp ON twp.provider_id = wp.id
      WHERE twp.title_id = ?
      ORDER BY twp.monetization_type, wp.display_priority
    `).all(id);

    console.log("SQLite results count:", rows.length);

    // Grupla: monetizationType -> providers[]
    const grouped = rows.reduce((acc: Record<string, any[]>, row: any) => {
      const key = row.monetizationType;
      if (!acc[key]) acc[key] = [];
      acc[key].push({
        providerId: row.providerId,
        name: row.name,
        logoPath: row.logoPath,
        displayPriority: row.displayPriority,
        link: row.link,
        quality: row.quality,
        region: row.region,
        lastChecked: row.lastChecked,
      });
      return acc;
    }, {} as Record<string, any[]>);

    return NextResponse.json(grouped);
  } catch (e: any) {
    console.error("Watch providers API error:", e);
    return NextResponse.json({ error: e.message, stack: e.stack }, { status: 500 });
  }
}