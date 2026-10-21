/**
 * Test/dogrulama hesaplarini ve onlara ait tum verileri siler.
 *
 *   node scripts/clean-test-account.mjs --email verify_1792505867924@cinemaverse.local
 *   node scripts/clean-test-account.mjs --email ... --apply
 *
 * Varsayilan olarak yalnizca DRY-RUN yapar; silmek icin --apply gerekir.
 * Yalnizca acikca verilen e-posta/ad ile eslesen hesaplari hedefler.
 */
import Database from "better-sqlite3";

const APPLY = process.argv.includes("--apply");
const emailArg = process.argv[process.argv.indexOf("--email") + 1];
const nameArg = process.argv.includes("--display-name")
  ? process.argv[process.argv.indexOf("--display-name") + 1]
  : null;

if (!emailArg && !nameArg) {
  console.error("Kullanim: --email <adres> [--display-name <ad>] [--apply]");
  process.exit(1);
}

const db = new Database("data/cinemaverse.db");
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const user = db
  .prepare(
    `select id, display_name, email from users
     where (? is not null and email = ?) or (? is not null and display_name = ?)`
  )
  .get(emailArg ?? null, emailArg ?? null, nameArg, nameArg);

if (!user) {
  console.log("Hesap bulunamadi, yapilacak bir sey yok.");
  process.exit(0);
}

const tables = db
  .prepare("select name from sqlite_master where type='table'")
  .all()
  .map((row) => row.name);

const ownedTables = tables.filter((table) => {
  const columns = db
    .prepare(`pragma table_info(${table})`)
    .all()
    .map((column) => column.name);
  return columns.includes("user_id");
});

const counts = {};
for (const table of ownedTables) {
  const row = db
    .prepare(`select count(*) as c from ${table} where user_id = ?`)
    .get(user.id);
  if (row.c > 0) counts[table] = row.c;
}

console.log("Hesap:", user);
console.log("Silinecek kayitlar:", counts);

if (!APPLY) {
  console.log("Dry-run. Silmek icin --apply ekleyin.");
  process.exit(0);
}

const run = db.transaction(() => {
  // Bagli kayitlar once.
  db.prepare(
    "delete from ai_messages where conversation_id in (select id from ai_conversations where user_id = ?)"
  ).run(user.id);
  db.prepare(
    "delete from research_items where session_id in (select id from research_sessions where user_id = ?)"
  ).run(user.id);
  db.prepare(
    "delete from discussion_posts where thread_id in (select id from discussion_threads where user_id = ?)"
  ).run(user.id);
  db.prepare(
    "delete from discussion_posts where user_id = ?"
  ).run(user.id);

  for (const table of ownedTables) {
    db.prepare(`delete from ${table} where user_id = ?`).run(user.id);
  }

  db.prepare("delete from users where id = ?").run(user.id);
});

run();
console.log("Silindi:", user.email);
db.close();
