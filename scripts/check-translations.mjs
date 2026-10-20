import Database from "better-sqlite3";
const db = new Database("data/cinemaverse.db", { readonly: true });
const c = (sql) => db.prepare(sql).get().c;
function looksTR(t) { return /[çğıöşüÇĞIİÖŞÜ]/.test(t); }
const rows = db.prepare(`SELECT id, overview, original_language FROM titles WHERE kind IN ('movie','series') AND overview IS NOT NULL AND overview != '' AND original_language != 'tr'`).all();
let tr = 0, en = 0;
rows.forEach(r => { if (looksTR(r.overview)) tr++; else en++; });
console.log("TR karakterli:", tr);
console.log("EN (çevrilecek):", en);
console.log("Toplam overview:", c(`SELECT COUNT(*) c FROM titles WHERE kind IN ('movie','series') AND overview IS NOT NULL AND overview != ''`));
db.close();