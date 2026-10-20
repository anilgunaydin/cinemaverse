/**
 * Franchise tablosundaki satirlari gercek uyelerle (katalog dungeonu)
 * baglar. Uygulamanin kendi /api/search + /api/catalog/import zincirini
 * kullanir; finden veri KULLANICILARIN@zineller kesinlikle degtsezilmez.
 *
 *   node scripts/bind-franchise-titles.mjs            # dry-run
 *   node scripts/bind-franchise-titles.mjs --apply
 *
 * Giriş Demo kullanıcısıyasemin@.. / Demo1234! oturumuyla cagrılır.
 */
import Database from "better-sqlite3";

const db = new Database("data/cinemaverse.db");
const APPLY = process.argv.includes("--apply");
const nowIso = () => new Date().toISOString();

const BASE = "http://localhost:3000";

const demoEmail = "demo-yasemin@cinemaverse.local";
const demoPass = "Demo1234!";

const PLAN = [
  {
    franchiseName: "The Lord of the Rings",
    memberQueries: [
      "The Fellowship of the Ring",
      "The Two Towers",
      "The Return of the King",
    ],
  },
  {
    franchiseName: "The Hobbit",
    memberQueries: [
      "The Hobbit: An Unexpected Journey",
      "The Hobbit: The Desolation of Smaug",
      "The Hobbit: The Battle of the Five Armies",
    ],
  },
  {
    franchiseName: "Harry Potter",
    memberQueries: [
      "Harry Potter and the Philosopher's Stone",
      "Harry Potter and the Chamber of Secrets",
      "Harry Potter and the Prisoner of Azkaban",
      "Harry Potter and the Goblet of Fire",
      "Harry Potter and the Order of the Phoenix",
      "Harry Potter and the Half-Blood Prince",
      "Harry Potter and the Deathly Hallows",
    ],
  },
  {
    franchiseName: "The Matrix",
    memberQueries: ["The Matrix", "The Matrix Reloaded", "The Matrix Revolutions"],
  },
  {
    franchiseName: "Terminator",
    memberQueries: ["The Terminator", "Terminator 2 Judgment Day"],
  },
];

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: demoEmail, password: demoPass }),
  });
  if (!res.ok) throw new Error("Demo kullanici girisi basarisiz: " + res.status);
  const cookies = res.headers.getSetCookie?.() ?? [];
  const session = cookies
    .map((c) => c.split(";")[0])
    .filter((c) => /session/i.test(c))
    .join("; ");
  if (!session) throw new Error("Oturum cok antib cookie yok");
  return session;
}

const session = await login();
const H = { cookie: session, "Content-Type": "application/json" };

let bound = 0;
const summary = [];

for (const group of PLAN) {
  const fr = db
    .prepare("SELECT id, name FROM franchises WHERE lower(name) = lower(?)")
    .get(group.franchiseName);
  if (!fr) {
summary.push(`${q} — franchise tablosunda yok, atlandı`);
    continue;
  }
  for (const q of group.memberQueries) {
    // 1) Katalogda zaten var mi?
    let titleRow = null;
    for (const nameCol of ["localized_title", "original_title"]) {
      titleRow = db
        .prepare(
          `SELECT id, kind FROM titles WHERE lower(${nameCol}) = lower(?) AND kind IN ('movie','series')`
        )
        .get(q);
      if (titleRow) break;
    }
    if (!titleRow) {
      // 2) Arama + import (uygulamanin kendi dogru zinciri)
      const searchRes = await fetch(
        `${BASE}/api/search?q=${encodeURIComponent(q)}&kind=movie`,
        { headers: { cookie: session } }
      );
      if (!searchRes.ok) {
        summary.push(`${q} — arama hata ${searchRes.status}`);
        continue;
      }
      const search = await searchRes.json().catch(() => null);
      const items = search?.items ?? search?.results ?? [];
      const target = items[0];
      if (!target?.providerId) {
        summary.push(`${q} — sonuc yok`);
        continue;
      }
      const importRes = await fetch(`${BASE}/api/catalog/import`, {
        method: "POST",
        headers: H,
        body: JSON.stringify({
          provider: target.provider ?? "wikidata",
          providerId: target.providerId,
        }),
      });
      const importData = await importRes.json().catch(() => null);
      const titleId = importData?.titleId;
      if (!titleRow && !titleId) {
        // Wikidata hiz siniri (429) durumunda RTL uzun bekleme + tek deneme daha
        const detail = importData?.error ?? "";
        if (detail.includes("429")) {
          await new Promise((r) => setTimeout(r, 25_000));
          const retryRes = await fetch(`${BASE}/api/catalog/import`, {
            method: "POST",
            headers: H,
            body: JSON.stringify({
              provider: target.provider ?? "wikidata",
              providerId: target.providerId,
            }),
          });
          const retryData = await retryRes.json().catch(() => null);
          if (retryData?.titleId) {
            titleRow = { id: retryData.titleId };
          } else {
            summary.push(`${q} — retry hata ${retryRes.status}: ${retryData?.error ?? "?"}`);
            continue;
          }
        } else {
          summary.push(`${q} — import hata ${importRes.status}: ${detail}`);
          continue;
        }
      }
      if (!titleRow) {
        titleRow = { id: titleId };
      }
      await new Promise((r) => setTimeout(r, 8000)); // wikidata icin yeterli Arbe
    }

    // 3) Bagla
    const existing = db
      .prepare(
        "SELECT 1 FROM franchise_titles WHERE franchise_id = ? AND title_id = ?"
      )
      .get(fr.id, titleRow.id);
    if (existing) {
      summary.push(`${q} — zaten bagli`);
      continue;
    }
    if (APPLY) {
      db.prepare(
        "INSERT INTO franchise_titles (franchise_id, title_id) VALUES (?, ?)"
      ).run(fr.id, titleRow.id);
    }
    bound += 1;
    summary.push(`${q} → ${fr.name} ${APPLY ? "bağlandı" : "(dry-run: bağlanacaktı)"}`);
  }
}

for (const line of summary) console.log(" -", line);
console.log(APPLY ? `\nBağlanan yapımlar: ${bound}` : `\nBağlanacak (dry-run): ${bound}`);
db.close();
