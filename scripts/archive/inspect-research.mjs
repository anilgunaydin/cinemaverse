/**
 * Son arastirma oturumlarinin icerigini dogrular (yalnizca gelistirme).
 * Kullanim: node scripts/inspect-research.mjs
 */
import Database from "better-sqlite3";
import path from "node:path";
import process from "node:process";

const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "cinemaverse.db");
const db = new Database(dbPath, { readonly: true });

const sessions = db
  .prepare(
    `select id, user_id, title_id, status, source_count, summary_generated_by_ai, created_at
     from research_sessions order by created_at desc limit 5`,
  )
  .all();

console.log(`Arastirma oturumlari: ${sessions.length}`);
for (const session of sessions) {
  console.log(`\n- ${session.id} [${session.status}] kaynak=${session.source_count} ai=${session.summary_generated_by_ai}`);
  const items = db
    .prepare(
      `select source_name, heading, spoiler_risk, substr(excerpt, 1, 120) as excerpt, source_url, license_note
       from research_items where session_id = ?`,
    )
    .all(session.id);
  for (const item of items) {
    console.log(`    [${item.source_name}] ${item.heading ?? "-"} (risk: ${item.spoiler_risk})`);
    console.log(`      ${item.excerpt.replace(/\s+/g, " ")}…`);
    console.log(`      ${item.source_url}`);
    console.log(`      lisans: ${item.license_note}`);
  }
}

db.close();
