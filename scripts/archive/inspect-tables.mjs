import Database from "better-sqlite3";

const db = new Database("data/cinemaverse.db", { readonly: true });
const tables = db
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
  )
  .all()
  .map((t) => t.name);

for (const t of tables) {
  const cols = db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name);
  const u = cols.filter((c) =>
    /user_id|blocked_user_id|muted_user_id/.test(c)
  );
  console.log(t + (u.length ? "  <= [" + u.join(", ") + "]" : ""));
}
db.close();
