import Database from "better-sqlite3";
const db = new Database("data/cinemaverse.db", { readonly: true });

console.log("== dagilim ==");
console.log(JSON.stringify(db.prepare("SELECT language, COUNT(*) c FROM external_comments GROUP BY language").all()));
console.log("toplam:", db.prepare("SELECT COUNT(*) c FROM external_comments").get().c);
console.log("kaplanan yapim:", db.prepare("SELECT COUNT(DISTINCT title_id) c FROM external_comments").get().c);

console.log("\n== ornek yorumlar (3 TR, 3 EN) ==");
for (const r of db.prepare("SELECT body, language FROM external_comments WHERE language = 'tr' LIMIT 3").all())
  console.log("[TR]", r.body.slice(0, 160));
for (const r of db.prepare("SELECT body, language FROM external_comments WHERE language = 'en' LIMIT 3").all())
  console.log("[EN]", r.body.slice(0, 160));

// kalite skoru: kirinti kaliyor mu
const dirty = db
  .prepare(
    "SELECT COUNT(*) c FROM external_comments WHERE body LIKE '%{{%' OR body LIKE '%<reference%' OR body LIKE '%></%>' OR body LIKE '%| %=%'"
  )
  .get().c;
console.log("\nkirintili gorunen:", dirty);
db.close();
