/**
 * Veritabani durumunu inceler (salt okunur).
 * Kullanim: node scripts/inspect-db-state.mjs
 */
import Database from "better-sqlite3";
import path from "node:path";

const dbPath = process.env.DATABASE_PATH?.trim() || "./data/cinemaverse.db";
const db = new Database(path.resolve(dbPath), { readonly: true });

console.log("=== KULLANICILAR ===");
const users = db.prepare(`select id, email, display_name, role, library_visibility, created_at from users order by created_at`).all();
for (const u of users) {
  console.log(`${u.id} | ${u.email} | "${u.display_name}" | role=${u.role} | lib=${u.library_visibility} | ${u.created_at}`);
}

console.log("\n=== TITLES SAYISI ===");
console.log(db.prepare(`select count(*) c from titles`).get());

console.log("\n=== TITLES (kind bazinda) ===");
console.log(db.prepare(`select kind, count(*) c from titles group by kind`).all());

console.log("\n=== TITLES LISTESI ===");
const titles = db.prepare(`select id, kind, original_title, localized_title, release_year, tmdb_id, tvmaze_id, imdb_id, wikidata_id, parent_id from titles order by kind, release_year`).all();
for (const t of titles) {
  console.log(`${t.id} | ${t.kind} | ${t.original_title} | loc=${t.localized_title ?? "-"} | ${t.release_year ?? "-"} | tmdb=${t.tmdb_id ?? "-"} tvmaze=${t.tvmaze_id ?? "-"} imdb=${t.imdb_id ?? "-"} wd=${t.wikidata_id ?? "-"} parent=${t.parent_id ?? "-"}`);
}

console.log("\n=== TITLE_ALIASES ===");
const aliases = db.prepare(`select ta.title_id, ta.name, ta.language, ta.provider from title_aliases ta order by lower(ta.name)`).all();
console.log(`toplam: ${aliases.length}`);
for (const a of aliases) {
  console.log(`${a.title_id} | ${a.name} | ${a.language ?? "-"} | ${a.provider ?? "-"}`);
}

console.log("\n=== FRANCHISES ===");
console.log(db.prepare(`select * from franchises`).all());
console.log(db.prepare(`select * from franchise_titles`).all());

console.log("\n=== LIBRARY_ENTRIES (kullanici bazinda) ===");
console.log(db.prepare(`select user_id, count(*) c, sum(rating is not null) rated from library_entries group by user_id`).all());

console.log("\n=== LIBRARY_ENTRIES DETAY (Anıl olmayan herkes icin ozet) ===");
const libs = db.prepare(`select le.user_id, le.title_id, t.original_title, t.kind, le.status, le.rating, le.notes from library_entries le join titles t on t.id = le.title_id order by le.user_id, t.original_title`).all();
for (const l of libs) {
  console.log(`${l.user_id} | ${l.title_id} | ${l.kind} | ${l.original_title} | ${l.status} | rating=${l.rating ?? "null"} | notes=${l.notes ? JSON.stringify(l.notes).slice(0, 60) : "-"}`);
}

console.log("\n=== PREFERENCE_PROFILES ===");
console.log(db.prepare(`select user_id, substr(profile_json,1,300) p, confidence, rated_title_count from preference_profiles`).all());

console.log("\n=== USER_TITLE_DIMENSIONS ===");
console.log(db.prepare(`select count(*) c from user_title_dimensions`).get());

console.log("\n=== TITLE_TRAITS (userId<>'') ===");
console.log(db.prepare(`select count(*) c from title_traits where user_id <> ''`).get());

console.log("\n=== REVIEW_REPLIES / REVIEWS / DISCUSSION ===");
console.log(db.prepare(`select count(*) c from reviews`).get());
console.log(db.prepare(`select count(*) c from discussion_threads`).get());
console.log(db.prepare(`select count(*) c from discussion_posts`).get());

db.close();
