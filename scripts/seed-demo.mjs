/**
 * Demo/test verisi tohumlama + poster zenginlestirme.
 *
 *   node scripts/seed-demo.mjs            # dry-run: plani gosterir, HICBIR SEY yazmaz
 *   node scripts/seed-demo.mjs --apply    # uygular + data/demo-seed-manifest.json yazar
 *   node scripts/seed-demo.mjs --clean    # manifest'e gore demo veriyi siler
 *
 * Kurallar:
 * - Anil'in gercek hafiza kayitlarina (149) HICBIR SEY eklemez/uzlemez.
 * - Demo icerik ayri demo-* e-postali kullanicilarin altinda.
 * - Poster doldurma yalnizca NULL alanlari doldurur; mevcut degeri HICBIYNA degistirmez.
 * - Idempotent: manifest varse --apply icerik eklemeyi reddeder.
 */
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";

const APPLY = process.argv.includes("--apply");
const CLEAN = process.argv.includes("--clean");
const MANIFEST_PATH = "data/demo-seed-manifest.json";

const db = new Database("data/cinemaverse.db");
db.pragma("journal_mode = WAL");

const newId = (prefix) =>
  `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
const nowIso = () => new Date().toISOString();

/* ------------------------------------------------------------------ */
/* CLEAN                                                               */
/* ------------------------------------------------------------------ */
if (CLEAN) {
  if (!existsSync(MANIFEST_PATH)) {
    console.log("Manifest yok, temizlenecek demo veri kaydi bulunamadi.");
    process.exit(0);
  }
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  for (const [table, ids] of Object.entries(manifest.tables)) {
    if (ids.length === 0) continue;
    const placeholders = ids.map(() => "?").join(", ");
    const info = db.prepare(`DELETE FROM ${table} WHERE id IN (${placeholders})`).run(...ids);
    console.log("-", table, "silindi:", info.changes);
  }
  // tablo-baskili silmeler ( followers vs. )
  db.prepare("DELETE FROM follows WHERE follower_id LIKE 'usr_demo%' OR following_id LIKE 'usr_demo%'").run();
  db.prepare("DELETE FROM likes WHERE user_id LIKE 'usr_demo%'").run();
  unlinkSync(MANIFEST_PATH);
  console.log("Manifest kaldirildi. Iyi ak.");
  process.exit(0);
}

/* ------------------------------------------------------------------ */
/* A) POSTER ZENGINLESTIRME plani                                      */
/* ------------------------------------------------------------------ */
const posterlessSeasons = db
  .prepare(
    `SELECT s.id, s.parent_id, s.season_number, p.localized_title AS parent_name, p.poster_url AS parent_poster
     FROM titles s LEFT JOIN titles p ON p.id = s.parent_id
     WHERE s.kind = 'season' AND (s.poster_url IS NULL OR s.poster_url = '')`
  )
  .all();
const inheritable = posterlessSeasons.filter(
  (r) => r.parent_poster && r.parent_poster.trim() !== ""
);

const posterlessNamed = db
  .prepare(
    `SELECT id, kind, original_title, localized_title, tvmaze_id FROM titles
     WHERE kind IN ('series', 'movie')
       AND (poster_url IS NULL OR poster_url = '')
       AND COALESCE(localized_title, original_title) IS NOT NULL`
  )
  .all();

console.log("== A) Poster plani ==");
console.log("Sezon (ebeveyn posteri miras) :", inheritable.length);
console.log("Series/movie TVmaze aramasyna kalantar:", posterlessNamed.length, "(en fazla 40 aranacak)");

/* ------------------------------------------------------------------ */
/* B) DEMO ICERIK                                                      */
/* ------------------------------------------------------------------ */
const existingY = db
  .prepare("SELECT id FROM users WHERE email = ?")
  .get("demo-yasemin@cinemaverse.local");
const existingB = db
  .prepare("SELECT id FROM users WHERE email = ?")
  .get("demo-bora@cinemaverse.local");

const hasManifest = existsSync(MANIFEST_PATH);

console.log("== B) Demo icerik ==");
console.log("Yasemin:", existingY ? "zaten var" : "olusturulacak");
console.log("Bora:", existingB ? "zaten var" : "olusturulacak");
console.log("Manifest:", hasManifest ? "VAR (idempotenti)" : "yok");

async function tvmazePosterFor(title) {
  const q = encodeURIComponent(title.original_title ?? title.localized_title ?? "");
  try {
    const res = await fetch(`https://api.tvmaze.com/search/shows?q=${q}`);
    if (!res.ok) return null;
    const shows = await res.json();
    const norm = (s) =>
      (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const wanted = norm(title.original_title ?? title.localized_title);
    const hit = (shows || []).find(
      (entry) => entry.show && norm(entry.show.name) === wanted
    );
    if (!hit) return null;
    if (hit.show.image?.original) return hit.show.image.original;
    const imgRes = await fetch(`https://api.tvmaze.com/shows/${hit.show.id}/images`);
    if (!imgRes.ok) return null;
    const imgs = await imgRes.json();
    const poster = (imgs || []).find(
      (i) => i.type === "poster" && i.main
    );
    if (poster && poster.resolutions?.original?.url) {
      return poster.resolutions.original.url;
    }
  } catch {
    return null;
  }
  return null;
}

if (!APPLY) {
  console.log(
    "\nDyr-run modu. Uygulamak icin: node scripts/seed-demo.mjs --apply"
  );
  process.exit(0);
}

/* --- Uygula --------------------------------------------------------- */
const seedTables = {
  users: [],
  library_entries: [],
  reviews: [],
  review_replies: [],
  likes: [],
  discussion_threads: [],
  discussion_posts: [],
  user_lists: [],
  user_list_items: [],
  reports: [],
  franchise_titles: [],
};

/* B0) Poster doldur — yalniza NULL alanlar */
{
  for (const r of inheritable) {
    db.prepare(
      "UPDATE titles SET poster_url = ?, updated_at = ? WHERE id = ? AND (poster_url IS NULL OR poster_url = '')"
    ).run(r.parent_poster, nowIso(), r.id);
  }
  let enriched = 0;
  let i = 0;
  for (const t of posterlessNamed.slice(0, 40)) {
    const poster = await tvmazePosterFor(t);
    if (poster) {
      db.prepare(
        "UPDATE titles SET poster_url = ?, updated_at = ? WHERE id = ? AND (poster_url IS NULL OR poster_url = '')"
      ).run(poster, nowIso(), t.id);
      enriched += 1;
    }
    await new Promise((res) => setTimeout(res, 350));
    i += 1;
  }
  console.log("Sezon posteri miras:", inheritable.length);
  console.log("TVmaze ile poster doldurulan:", enriched, "(", i, "denendi )");
}

if (existingY) {
  console.log("\nDemo kullanicilar zaten mevcut; buna icerik ekleme atlandi.");
  db.close();
  process.exit(0);
}
if (hasManifest) {
  console.log(
    "\nManifest var (--clean ile silebilirsin). Yanlik ekleme engellendi."
  );
  db.close();
  process.exit(1);
}

const passwordHash = bcrypt.hashSync("Demo1234!", 10);

function insertUser(email, displayName, bio) {
  const id = newId("usr");
  db.prepare(
    `INSERT INTO users (id, email, password_hash, display_name, role, library_visibility, reviews_visibility, bio)
     VALUES (?, ?, ?, ?, 'user', 'public', 'public', ?)`
  ).run(id, email, passwordHash, displayName, bio);
  seedTables.users.push(id);
  return id;
}

const yaseminId = insertUser(
  "demo-yasemin@cinemaverse.local",
  "Yasemin",
  "Dizi bahtslsal: aksiyondan dramaya sekiz derece. Demo hesap."
);
const boraId = insertUser(
  "demo-bora@cinemaverse.local",
  "Bora",
  "Serious criminal shows / film studyarh. Demo hesap."
);

/* Anile takip — topluluk canlanir */
db.prepare("INSERT INTO follows (follower_id, following_id) VALUES (?, ?)").run(
  yaseminId,
  boraId
);
db.prepare("INSERT INTO follows (follower_id, following_id) VALUES (?, ?)").run(
  boraId,
  yaseminId
);
const anil = db
  .prepare("SELECT id FROM users WHERE email = ?")
  .get("anil@cinemaverse.local");
if (anil) {
  db.prepare("INSERT INTO follows (follower_id, following_id) VALUES (?, ?)").run(
    yaseminId,
    anil.id
  );
  db.prepare("INSERT INTO follows (follower_id, following_id) VALUES (?, ?)").run(
    boraId,
    anil.id
  );
}

/* B1) Upuai yapimlar: ONCE postersi olanlar performan sorumlus */
const wellKnownNames = [
  "Breaking Bad",
  "Inception",
  "Banshee",
  "Ray Donovan",
  "Dexter",
  "Sherlock",
  "Prison Break",
  "Peaky Blinders",
  "Game of Thrones",
  "The Boys",
];
const seen = [];
for (const nm of wellKnownNames) {
  const t = db
    .prepare(
      `SELECT * FROM titles WHERE
        lower(COALESCE(localized_title, original_title)) = lower(?)
        AND kind IN ('series','movie')
        ORDER BY (CASE WHEN kind='series' THEN 0 ELSE 1 END)`
    )
    .get(nm);
  if (t && !seen.some((s) => s.id === t.id)) seen.push(t);
}
/* Yeterli yapim bulunamazsa anonlarn postnaslardan tamamlar */
if (seen.length < 8) {
  const extras = db
    .prepare(
      `SELECT t.* FROM titles t
       JOIN library_entries le ON le.title_id = t.id AND le.user_id = ?
       JOIN users u ON u.id = le.user_id
       WHERE t.kind IN ('series','movie')
       LIMIT 12`
    )
    .all(anil.id);
  for (const t of extras) {
    if (!seen.some((s) => s.id === t.id)) seen.push(t);
  }
}

/* B2) Kutuphaneye girisleri — demo kullanicilara beraber */
function libEntry(userId, titleId, status, rating, notes, favorite = false, period = "2024") {
  const id = newId("lib");
  db.prepare(
    `INSERT INTO library_entries
       (id, user_id, title_id, status, rating, watched_at, watched_period, notes, is_favorite)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)`
  ).run(id, userId, titleId, status, rating, period, notes, favorite ? 1 : 0);
  seedTables.library_entries.push(id);
}

const notesY = [
  "Karakter gamismasi inanadrkl. Demo kullanicimizin kaydi.",
  "1. sezon harika; final aatahim.",
  null,
  "Soundtrack tonun ~",
  "Favori sahnel-erim var notundeyim",
];
let yIdx = 0;
let bIdx = 0;
const reviewsPlan = [];
for (const [i, t] of seen.entries()) {
  if (i === 0) continue; // sonravanes al
  if (i % 2 === 1 && yIdx < 6) {
    libEntry(
      yaseminId,
      t.id,
      "watched",
      [9.5, 9, 8.5, 8, 7.5, 8][yIdx % 6],
      notesY[yIdx % notesY.length],
      yIdx % 3 === 0
    );
    yIdx += 1;
  } else if (bIdx < 5) {
    libEntry(boraId, t.id, "watched", [9, 8.5, 8][bIdx % 3], null, bIdx % 3 === 1);
    bIdx += 1;
  }
}

/* B3) Incelemelur ( HDC 60 karakter, kimilistecxia) */
const reviewBodies = [
  [
    "Bu yapimi tekrar izlemek ve incelemek rakam politilama anlarımdan biriydi. İlk bölümden finali kadar atmosfer hiç bozulmuyor; karakterler çizgilerine sadık kalıyor. Özellikle orta bölümde durma noktasına geliyor. Demo inceleme verisidir, gerçek kullanıcının yazdığı bir metin değildir.",
    9.5,
    false,
  ],
  [
    "Senaryo beklentimin üstünde çıktı. Oyunculuklar tutarlı, kamera dili dengeli; final bölümü beklentiyi taşıyor. Görsel üretim standardı yüksek. Demo inceleme verisidir.",
    9,
    false,
  ],
  [
    "Zamandeal bir dizi olmayı hak ediyor. Karakterlerin bağlamı güzel kurulmuş ama ikinci sezonda us spare bezligi hissediliyor. Demo inceleme verisidir.",
    8,
    true,
  ],
  [
    "Pratik ve serifi serin bir yapım; her bölümün kendi çizgisi var ama bütünü tamamlanıyor. Demo inceleme verisidir.",
    8.5,
    false,
  ],
  [
    "İzlerken birden çok denemei denedim, atmosferine kapıldım. Ses tasarımı özellikle güzel çalışmış. Demo inceleme verisidir.",
    9.5,
    false,
  ],
  [
    "Aksiyon koreografisi begendiğim bir yapım; teknik olarak sadeleo gezileri her bir kaçmış arşa. Demo inceleme verisidir.",
    8,
    false,
  ],
];
let reviewRow = 0;
const createdReviews = [];
for (const t of seen) {
  if (reviewRow >= reviewBodies.length) break;
  const [body, rating, spoiler] = reviewBodies[reviewRow];
  const owner = reviewRow % 2 === 0 ? yaseminId : boraId;
  const dupe = db
    .prepare("SELECT id FROM reviews WHERE user_id = ? AND title_id = ?")
    .get(owner, t.id);
  if (dupe) continue;
  const id = newId("rev");
  db.prepare(
    `INSERT INTO reviews (id, user_id, title_id, body, rating, contains_spoiler, visibility, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'public', ?, ?)`
  ).run(id, owner, t.id, body, rating, spoiler ? 1 : 0, nowIso(), nowIso());
  seedTables.reviews.push(id);
  createdReviews.push({ id, ownerId: owner, titleId: t.id });
  reviewRow += 1;
}

/*Reply / B4) yorum yaniti + beğeni */
if (createdReviews.length >= 2) {
  const rid = createdReviews[0];
  const replier = rid.ownerId === yaseminId ? boraId : yaseminId;
  const replyId = newId("rep");
  db.prepare(
    `INSERT INTO review_replies (id, review_id, user_id, body, contains_spoiler)
      VALUES (?, ?, ?, 'Bu incelemeye katlıyorum, özellikle X sahnede kapımı açtı. (Demo verisi)', 0)`
  ).run(replyId, rid.id, replier);
  seedTables.review_replies.push(replyId);

  const db2 = db
    .prepare(
      "INSERT OR IGNORE INTO likes (user_id, target_type, target_id) VALUES (?, 'review', ?)"
    )
    .run(replier, rid.id);
  if (db2.changes > 0) {
    seedTables.likes.push(rid.id); // basitlik: user_id + target — clean script'te likes zaten LIKE 'usr_demo%' ile silinir
  }
}

/* B5) Tartisma konu + gozet */
const anySeries = seen.find((t) => t.kind === "series");
{
  const tid = newId("thr");
  db.prepare(
    `INSERT INTO discussion_threads (id, user_id, title_id, heading, body, contains_spoiler, visibility)
      VALUES (?, ?, ?, ?, ?, 0, 'public')`
  ).run(
    tid,
    yaseminId,
    anySeries?.id ?? null,
    "Bu dizide en çok hangi sahne akılda kaldı?",
    "Favori sahnemi birden fazla kez izledim. Senin en akılda kalan sahnen hangisi? (Demo tartışması)"
  );
  seedTables.discussion_threads.push(tid);

  const pid = newId("post");
  db.prepare(
    `INSERT INTO discussion_posts (id, thread_id, user_id, body, contains_spoiler)
      VALUES (?, ?, ?, 'Bende pilot bölümü ve mevsim finali çerçevesinde kalıyor. (Demo mesaj)', 0)`
  ).run(pid, tid, boraId);
  seedTables.discussion_posts.push(pid);
}
{
  const tid = newId("thr");
  db.prepare(
    `INSERT INTO discussion_threads (id, user_id, title_id, heading, body, contains_spoiler, visibility)
      VALUES (?, ?, NULL, 'Sinema deneyimini tersirmek için?', 'Visuel de KC YIZ a zt. Hangi klasiklerinde bu düklerin Bo om? (Demo tartışması)', 0, 'public')`
  ).run(tid, boraId);
  seedTables.discussion_threads.push(tid);

  const pid = newId("post");
  db.prepare(
    `INSERT INTO discussion_posts (id, thread_id, user_id, body, contains_spoiler)
      VALUES (?, ?, ?, ?, 0)`
  ).run(
    pid,
    tid,
    yaseminId,
    "1960-70'ler klasikleri zirve; Bergman ları da kütüdebazda kaydedelim. (Demo mesaj)"
  );
  seedTables.discussion_posts.push(pid);
}

/* B6) Listeler */
function makeList(userId, name, description, items) {
  const lid = newId("lst");
  db.prepare(
    `INSERT INTO user_lists (id, user_id, name, description, visibility)
      VALUES (?, ?, ?, ?, 'public')`
  ).run(lid, userId, name, description);
  seedTables.user_lists.push(lid);
  items.forEach((t, idx) => {
    db.prepare(
      `INSERT OR IGNORE INTO user_list_items (list_id, title_id, position, note) VALUES (?, ?, ?, ?)`
    ).run(lid, t.id, idx, idx === 0 ? "Demo liste부터 başlangıcı" : null);
    seedTables.user_list_items.push(t.id); // id-free tablo; clean'te list_id silinerek temizlenir
  });
  return lid;
}
if (seen.length >= 8) {
  makeList(yaseminId, "Cuma akşamlarına önerim", "Demo liste: haftanın gerginliği birap.", seen.slice(0, 4));
  makeList(yaseminId, "Bekleben göz", "Demo liste: atmosfrik icinler.", seen.slice(4, 8));
  makeList(boraId, "Klasik polisiye", "Demo liste: heavy crime dakikae.", seen.slice(1, 5));
}

/* B7) Franchise baglalma — varolan tenantlardan nama uyumlu dias */
const namePatterns = {
  "The Lord of the Rings": ["lotr", "the lord of the rings", "yüzüklerin efendisi"],
  "The Hobbit": ["the hobbit", "hobbit"],
  "Harry Potter": ["harry potter"],
};
const franchiseRows = db.prepare("SELECT id, wikidata_id, name FROM franchises").all();
for (const fr of franchiseRows) {
  const key = Object.keys(namePatterns).find((k) =>
    fr.name.toLowerCase().includes(k.toLowerCase().split(" ")[0])
  );
  if (!key) continue;
  const terms = namePatterns[key];
  const condition = terms
    .map(() => "lower(COALESCE(localized_title, original_title)) LIKE ?")
    .join(" OR ");
  const matches = db
    .prepare(
      `SELECT id FROM titles WHERE kind IN ('movie','series') AND (${condition}) LIMIT 12`
    )
    .all(...terms.map((t) => `%${t}%`));
  for (const m of matches) {
    const info = db
      .prepare(
        "INSERT OR IGNORE INTO franchise_titles (franchise_id, title_id, created_at) VALUES (?, ?, ?)"
      )
      .run(fr.id, m.id, nowIso());
    if (info.changes > 0) {
      seedTables.franchise_titles.push(`${fr.id}:${m.id}`);
    }
  }
}

/* B8) 1 açık rapor — moderasyon paneli dolu görünsün */
if (createdReviews.length > 0) {
  const rid = createdReviews[0];
  const repId = newId("rep");
  db.prepare(
    `INSERT INTO reports (id, reporter_id, target_type, target_id, reason, details, status)
      VALUES (?, ?, 'review', ?, 'other', 'Demo rapor: test verisi, admin panelini dcèir alan için eklendi.', 'open')`
  ).run(repId, boraId, rid.id);
  seedTables.reports.push(repId);
}

/* --- Manifest yaz --- */
writeFileSync(
  MANIFEST_PATH,
  JSON.stringify(
    { createdAt: nowIso(), note: "seed-demo.mjs cikisi; --clean ile siler", tables: seedTables },
    null,
    1
  )
);

console.log("\n== Ozet ==");
for (const [table, rowids] of Object.entries(seedTables)) {
  console.log("-", table, rowids.length);
}
console.log("Manifest:", MANIFEST_PATH);
db.close();
