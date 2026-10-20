/**
 * Kaynak adi <-> veritabani kaydi karsilastirmasi (salt okunur).
 * Kullanim: node scripts/verify-import-names.mjs
 */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const dbPath = process.env.DATABASE_PATH?.trim() || "./data/cinemaverse.db";
const db = new Database(path.resolve(dbPath), { readonly: true });

const normalized = (s) =>
  s
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const user = db
  .prepare(`select id, display_name from users where display_name = 'Anıl'`)
  .get();
if (!user) {
  console.error("HATA: 'Anıl' kullanıcısı yok");
  process.exit(1);
}

const source = JSON.parse(
  fs.readFileSync(
    path.resolve("anıl/cinemaverse_personal_memory_import.json"),
    "utf8",
  ),
);

const sourceRecords = [
  ...source.scored_titles.map((r) => ({ title: r.title, kind: r.kind })),
  ...source.unwatched_titles.map((r) => ({ title: r.title, kind: "unwatched" })),
  ...source.partially_watched_titles.map((r) => ({ title: r.title, kind: "partially_watched" })),
  ...source.watched_unrated_titles.map((r) => ({ title: r.title, kind: "watched_unrated" })),
  ...source.uncertain_status_titles.map((r) => ({ title: r.title, kind: "unknown" })),
];

const rows = db
  .prepare(
    `select t.original_title, t.localized_title, t.kind, t.release_year,
            le.status, le.rating, le.is_favorite
       from library_entries le join titles t on t.id = le.title_id
      where le.user_id = ?`,
  )
  .all(user.id);

console.log(`Hedef kullanici: ${user.display_name} (${user.id})`);
console.log(`Kaynak kayit: ${sourceRecords.length} | DB kaydi: ${rows.length}\n`);

const used = new Set();
const problems = [];

for (const record of sourceRecords) {
  const src = normalized(record.title);
  const alts = record.title
    .split("/")
    .map((a) => normalized(a))
    .filter((a) => a && a !== src);

  let best = null;
  let bestScore = 0;
  for (let i = 0; i < rows.length; i += 1) {
    if (used.has(i)) continue;
    const row = rows[i];
    const keys = [normalized(row.original_title)];
    if (row.localized_title) keys.push(normalized(row.localized_title));
    let score = 0;
    for (const key of keys) {
      if (key === src) score = Math.max(score, 1);
      else if (alts.includes(key)) score = Math.max(score, 0.95);
      else if (src.startsWith(`${key} `) || key.startsWith(`${src} `)) score = Math.max(score, 0.9);
      else if (src.includes(key) && key.length > 4) score = Math.max(score, 0.85);
    }
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }

  if (best === null || bestScore < 0.8) {
    problems.push(`  ! "${record.title}" -> ESLESME YOK`);
    continue;
  }
  used.add(best);
  const row = rows[best];
  const label = row.original_title;
  if (bestScore < 1) {
    problems.push(
      `  ~ "${record.title}" -> "${label}" (${row.kind}, eslesme=${bestScore.toFixed(2)})`,
    );
  }
}

console.log("=== Kaynak adlariyla farkli/uyumsuz eslesmeler ===");
for (const p of problems) console.log(p);
console.log(`Toplam: ${problems.length}`);

console.log("\n=== Latin alfabelesi disi (QID/Cince vb.) adlar ===");
const weird = rows.filter(
  (r) =>
    /^Q\d+$/.test(r.original_title) ||
    /[^\u0000-\u007F]/.test(r.original_title),
);
console.log(`  ${weird.length}`);
for (const w of weird) console.log(`  ! ${w.original_title}`);

console.log("\n=== Puan kapsami ===");
const franchise = rows.filter((r) => r.kind === "franchise");
const season = rows.filter((r) => r.kind === "season");
console.log(`  franchise: ${franchise.length} | season: ${season.length}`);
for (const f of franchise) console.log(`   - ${f.original_title} puan=${f.rating}`);

db.close();
