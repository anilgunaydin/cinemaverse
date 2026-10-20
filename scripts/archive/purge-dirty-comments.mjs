/** Basligi (===...) sizen yorum satirlarini temizler; fetch tekrar temiz hali ekler. */
import Database from "better-sqlite3";
const db = new Database("data/cinemaverse.db");
db.pragma("journal_mode = WAL");
const info = db.prepare("DELETE FROM external_comments WHERE body LIKE '%===%'").run();
console.log("Satirlari silinen kirin:", info.changes);
db.close();
