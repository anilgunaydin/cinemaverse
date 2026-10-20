import Database from "better-sqlite3";

const db = new Database("data/cinemaverse.db", { readonly: true });
for (const t of ["follows", "reports", "user_list_items", "ai_messages", "research_items", "reviews", "sessions"]) {
  const cols = db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name);
  console.log(t + ": " + cols.join(", "));
}
db.close();
