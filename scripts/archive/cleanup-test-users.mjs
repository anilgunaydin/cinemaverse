/**
 * Test kullanıcısı temizliği + Anıl admin ataması.
 *
 * Kullanım:
 *   node scripts/cleanup-test-users.mjs            # dry-run: neşe silinecekleri gösterir
 *   node scripts/cleanup-test-users.mjs --apply    # yedek alıp uygular
 *
 * Test kullanıcıları: smoke_* / verify_* / dbg_* e-postalar.
 * FK yok; çocuk kayıtlar (suit listeler, mesajlar vb.) elle temizlenir.
 */
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";

const APPLY = process.argv.includes("--apply");

const TEST_PATTERNS = ["smoke_*", "verify_*", "dbg_*"];
const ANIL_EMAIL = "anil@cinemaverse.local";

if (APPLY) {
  mkdirSync("data/backups", { recursive: true });
}

const db = new Database(APPLY ? "data/cinemaverse.db" : "data/cinemaverse.db", {
  readonly: false,
});

// ---- Kullanıcıları topla ----
const placeholderTest = TEST_PATTERNS.map(() => "email GLOB ?").join(" OR ");
const testUsers = db
  .prepare(`SELECT id, email, display_name FROM users WHERE ${placeholderTest}`)
  .all(...TEST_PATTERNS);
const ids = testUsers.map((u) => u.id);

const anil = db.prepare("SELECT id, email, role FROM users WHERE email = ?").get(ANIL_EMAIL);

console.log("== Dry-run bilgisi ==");
console.log("Silinecek test kullanıcısı:", testUsers.length);
for (const u of testUsers.slice(0, 50)) {
  console.log("  -", u.email, "(", u.display_name, ")");
}
console.log("Anıl:", anil ? `${anil.email} (şu an: ${anil.role}) -> admin` : "BULUNAMADI");

// ---- Silinecek satır sayıları ----
function count(sql, params) {
  return db.prepare(sql).get(...params).c;
}

const inIds = () => ids.map(() => "?").join(", ");

const deletes = [];
if (testUsers.length > 0) {
  // ID-tabanlı silmeler (user_id içeren tablolar)
  for (const table of [
    "ai_conversations",
    "audit_log",
    "blocks",
    "discussion_posts",
    "discussion_threads",
    "library_entries",
    "likes",
    "mutes",
    "preference_profiles",
    "recommendation_feedback",
    "recommendations",
    "research_sessions",
    "review_replies",
    "reviews",
    "title_traits",
    "user_title_dimensions",
  ]) {
    deletes.push({ table, sql: `DELETE FROM ${table} WHERE user_id IN (${inIds()})`, params: ids });
  }

  // Çoklu-kullanıcı sütunlu tablolar
  deletes.push({ table: "follows", sql: `DELETE FROM follows WHERE follower_id IN (${inIds()}) OR following_id IN (${inIds()})`, params: [...ids, ...ids] });
  deletes.push({ table: "reports", sql: `DELETE FROM reports WHERE reporter_id IN (${inIds()}) OR resolved_by IN (${inIds()})`, params: [...ids, ...ids] });

  // Çocuk zincirleri (sıra önemli)
  const convIds = db.prepare(`SELECT id FROM ai_conversations WHERE user_id IN (${inIds()})`).all(...ids).map((r) => r.id);
  if (convIds.length > 0) {
    deletes.push({ table: "ai_messages", sql: `DELETE FROM ai_messages WHERE conversation_id IN (${convIds.map(() => "?").join(",")})`, params: convIds });
  }
  const sessionIds = db.prepare(`SELECT id FROM research_sessions WHERE user_id IN (${inIds()})`).all(...ids).map((r) => r.id);
  if (sessionIds.length > 0) {
    deletes.push({ table: "research_items", sql: `DELETE FROM research_items WHERE session_id IN (${sessionIds.map(() => "?").join(",")})`, params: sessionIds });
  }
  const listIds = db.prepare(`SELECT id FROM user_lists WHERE user_id IN (${inIds()})`).all(...ids).map((r) => r.id);
  if (listIds.length > 0) {
    deletes.push({ table: "user_list_items", sql: `DELETE FROM user_list_items WHERE list_id IN (${listIds.map(() => "?").join(",")})`, params: listIds });
  }
  deletes.push({ table: "user_lists", sql: `DELETE FROM user_lists WHERE user_id IN (${inIds()})`, params: ids });

  deletes.push({ table: "users", sql: `DELETE FROM users WHERE id IN (${inIds()})`, params: ids });
}

console.log("\nSilinecek satır sayıları (dry-run):");
function countRows(d) {
  const where = d.sql.slice(d.sql.indexOf("WHERE"));
  const placeholders = (where.match(/\?/g) || []).length;
  const table = d.sql.match(/DELETE FROM (\w+)/)[1];
  return db.prepare(`SELECT COUNT(*) AS c FROM ${table} ${where}`).get(...d.params).c;
}
let grand = 0;
for (const d of deletes) {
  const c = countRows(d);
  grand += c;
  console.log("  ", d.table.padEnd(28), c);
}
console.log("TOPLAM satır:", grand);

if (!APPLY) {
  console.log('\nDry-run modu. Uygulamak için: node scripts/cleanup-test-users.mjs --apply');
  db.close();
  process.exit(0);
}

// ---- Uygula ----
const stamp = "cinemaverse-" + new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19) + "-pre-admin-cleanup";
const target = `data/backups/${stamp}.db`;
await db.backup(target);
console.log("\nYedek alındı:", target);

const tx = db.transaction(() => {
  for (const d of deletes) {
    d.sql;
    const info = db.prepare(d.sql).run(...d.params);
    console.log("  silindi", d.table.padEnd(28), info.changes);
  }
  if (anil && anil.role !== "admin") {
    db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(anil.id);
    console.log("Anıl admin yapıldı.");
  }
});
tx();

console.log("\nBitti.");
db.close();
