import Database from "better-sqlite3";
const db = new Database("data/cinemaverse.db", { readonly: true });
const rows = db.prepare("SELECT id, title_id, notes, rating, status FROM library_entries WHERE notes LIKE '%Otomatik test%' OR notes LIKE '%otomatik test%'").all();
console.log("Test kirliligi:", rows.length);
rows.forEach((r) => console.log("  -", r.id, r.title_id, JSON.stringify(r.notes)));
const revs = db.prepare("SELECT id, title_id, body FROM reviews WHERE body LIKE '%Otomatik test%' OR body LIKE '%otomatik test%'").all();
console.log("Inceleme test kirliligi:", revs.length);
revs.forEach((r) => console.log("  -", r.id, r.title_id, JSON.stringify(r.body)));
db.close();