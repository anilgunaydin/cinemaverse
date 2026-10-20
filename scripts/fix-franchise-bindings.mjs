/**
 * Franchise baglama duzeltmeleri (dogrulanmis, hedefli):
 * 1) LOTR'dan yanlis entity Q115285 (The Return of the King 1980 animasyon
 *    TV filmi) icindeki baglantayi cozer. Katalog satiri silinmez —
 *    gercek bir eser; sadece baglanti kaldirilir.
 * 2) Harry Potter'a eksik son filmi (Q232009, Ölüm Yadigârları Bölüm 2)
 *    uygulamanin kendi /api/catalog/import zinciriyle ekler ve baglar.
 *
 *   node scripts/fix-franchise-bindings.mjs           # dry-run
 *   node scripts/fix-franchise-bindings.mjs --apply
 */
import Database from "better-sqlite3";

const APPLY = process.argv.includes("--apply");
const BASE = "http://localhost:3000";
const db = new Database("data/cinemaverse.db");
db.pragma("journal_mode = WAL");

/* --- 1) Yanlis bagli LOTR entitysini coz ------------------------------ */
const lotr = db
  .prepare("SELECT id, name FROM franchises WHERE lower(name) = lower('The Lord of the Rings')")
  .get();
const wrongTitle = db
  .prepare("SELECT id FROM titles WHERE wikidata_id = 'Q115285'")
  .get();

if (lotr && wrongTitle) {
  const bound = db
    .prepare(
      "SELECT 1 FROM franchise_titles WHERE franchise_id = ? AND title_id = ?"
    )
    .get(lotr.id, wrongTitle.id);
  if (bound) {
    console.log("Yanlis baglanti bulundu: Q115285 ->", lotr.name);
    if (APPLY) {
      db.prepare(
        "DELETE FROM franchise_titles WHERE franchise_id = ? AND title_id = ?"
      ).run(lotr.id, wrongTitle.id);
      console.log("-> baglanti kaldirildi.");
    } else {
      console.log("-> (dry-run) baglanti kaldirilacakti.");
    }
  } else {
    console.log("Q115285 zaten bagli degil.");
  }
} else {
  console.log("LOTR franchise veya Q115285 satiri bulunamadi.");
}

/* --- 2) Eksik HP3 filmi ekle + bagla ---------------------------------- */
const hp = db
  .prepare("SELECT id, name FROM franchises WHERE lower(name) = lower('Harry Potter')")
  .get();
const hp8 = "Q232009"; // Harry Potter and the Deathly Hallows – Part 2
const existingHp8 = db
  .prepare("SELECT id FROM titles WHERE wikidata_id = ?")
  .get(hp8);

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "demo-yasemin@cinemaverse.local",
      password: "Demo1234!",
    }),
  });
  if (!res.ok) throw new Error("Demo girisi basarisiz: " + res.status);
  const cookies = res.headers.getSetCookie?.() ?? [];
  const session = cookies
    .map((c) => c.split(";")[0])
    .filter((c) => /session/i.test(c))
    .join("; ");
  return session;
}

if (!hp) {
  console.log("Harry Potter franchise bulunamadi.");
  db.close();
  process.exit(0);
}

let titleId = existingHp8?.id ?? null;
if (titleId) {
  console.log("Q232009 katalogda zaten var:", titleId);
} else {
  console.log("Q232009 katalogda yok; import edilecek...");
  const session = await login();
  if (APPLY) {
    const importRes = await fetch(`${BASE}/api/catalog/import`, {
      method: "POST",
      headers: { cookie: session, "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "wikidata", providerId: hp8 }),
    });
    const data = await importRes.json().catch(() => null);
    if (data?.titleId) {
      titleId = data.titleId;
      console.log("-> import tamam:", titleId, "(", data?.title?.name ?? "?", ")");
    } else {
      console.log(
        "-> import hata", importRes.status, data?.error ?? "?",
        "(429 ise birkaç dakika sonra tekrar koşturun: script idempotent)"
      );
    }
  } else {
    console.log("-> (dry-run) import edilecekti.");
  }
}

if (titleId && hp) {
  const bound = db
    .prepare("SELECT 1 FROM franchise_titles WHERE franchise_id = ? AND title_id = ?")
    .get(hp.id, titleId);
  if (!bound) {
    if (APPLY) {
      db.prepare("INSERT INTO franchise_titles (franchise_id, title_id) VALUES (?, ?)").run(
        hp.id,
        titleId
      );
      console.log("-> Harry Potter franchise'ina baglandi.");
    } else {
      console.log("-> (dry-run) Harry Potter'a baglanacakti.");
    }
  } else {
    console.log("Q232009 zaten Harry Potter'a bagli.");
  }
}

db.close();
