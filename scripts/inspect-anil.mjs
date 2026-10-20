import Database from "better-sqlite3";
const db = new Database("data/cinemaverse.db", { readonly: true });
console.log(
  "users:",
  db.prepare("SELECT COUNT(*) c FROM users").get().c
);
console.log(
  "anil role:",
  JSON.stringify(db.prepare("SELECT role FROM users WHERE email = ?").get("anil@cinemaverse.local"))
);
db.close();
