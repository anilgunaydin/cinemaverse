/**
 * CI Fixture - testler icin minimal ama yeterli veritabani
 *
 * Ağ erisimi gerektirmez; hizli calisir. CI'da migrations sonrasi calistirilir.
 *
 *   npx tsx scripts/seed-ci.ts
 */
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs";

const DB_PATH = process.env.DATABASE_PATH?.trim() || "./data/cinemaverse.db";
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const newId = (p: string) => `${p}_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
const now = new Date().toISOString();

console.log("[CI Seed] Preparing fixture data...");

/* --- Kullanici --- */
const passwordHash = bcrypt.hashSync("admin", 10);
const anilId = "usr_bf242909977947f5899828fc";

const existingUser = db
  .prepare("SELECT id FROM users WHERE email = ?")
  .get("anil@cinemaverse.local");

if (!existingUser) {
  db.prepare(
    `INSERT INTO users (id, email, password_hash, display_name, role, library_visibility, reviews_visibility, bio, created_at, updated_at)
     VALUES (?, ?, ?, 'Anıl', 'admin', 'public', 'public', ?, ?, ?)`
  ).run(
    anilId,
    "anil@cinemaverse.local",
    passwordHash,
    "Kişisel sinema hafızası. CI test verisi.",
    now,
    now
  );
  console.log("  + Anıl kullanıcısı oluşturuldu");
} else {
  console.log("  · Anıl kullanıcısı zaten var");
}

/* --- Turler (minimum) --- */
const GENRES = [
  ["action", "action", "Aksiyon"],
  ["drama", "drama", "Dram"],
  ["sci-fi", "science-fiction", "Bilim Kurgu"],
  ["crime", "crime", "Suç"],
  ["thriller", "thriller", "Gerilim"],
];

for (const [id, slug, nameTr] of GENRES) {
  db.prepare(
    `INSERT OR IGNORE INTO genres (id, slug, name_tr, name_en) VALUES (?, ?, ?, ?)`
  ).run(`genre_${id}`, slug, nameTr, slug);
}

/* --- Yapimlar --- */
const TITLES = [
  {
    id: "ttl_ci_inception",
    original: "Inception",
    localized: "Başlangıç",
    year: 2010,
    runtime: 148,
    rating: 8.8,
    ratingCount: 22000,
    trailer: "YoHD7X7L0V7bQKvUTB0i0S9CqCw",
    overview:
      "Başlangıç, 2010 bilimkurgu aksiyon filmidir. Film, Christopher Nolan tarafından yazılmış ve yönetilmiş olup, yapımcılığını eşi Emma Thomas ile birlikte üstlenmiştir.",
    genres: ["action", "drama", "sci-fi"],
    poster: "/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg",
    backdrop: "/s3TBrRGB1iav7gFOCNx3H31MoES.jpg",
  },
  {
    id: "ttl_ci_breaking_bad",
    original: "Breaking Bad",
    localized: "Breaking Bad",
    year: 2008,
    runtime: 47,
    rating: 9.5,
    ratingCount: 13000,
    trailer: "HhesaVX78R8Pb5GjViDUI0R2B6g",
    overview:
      "Breaking Bad, kimyasal öğretmeni Walter White'ın kanser teşhisi sonrası metamfetamin üretmeye karar vermesi üzerine kurulu bir dizidir.",
    genres: ["drama", "crime"],
    poster: "/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
    backdrop: "/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg",
  },
  {
    id: "ttl_ci_matrix",
    original: "The Matrix",
    localized: "Matrix",
    year: 1999,
    runtime: 136,
    rating: 8.7,
    ratingCount: 24000,
    trailer: "vKQi3bBA1yTw",
    overview:
      "Matrix, 1999 bilimkurgu aksiyon filmidir. Neo adlı bir programcının gerçeği öğrenmesini anlatır.",
    genres: ["action", "sci-fi"],
    poster: "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
    backdrop: "/fNG7i7RqMErkcqhohV2a6cV1Ehy.jpg",
  },
  {
    id: "ttl_ci_dark",
    original: "Dark",
    localized: "Dark",
    year: 2017,
    runtime: 53,
    rating: 8.7,
    ratingCount: 4200,
    trailer: "rrwycJ08PSA",
    overview:
      "Dark, bir Alman kasabasında zaman yolculuğu üzerine kurulu bilimkurgu dizisidir.",
    genres: ["drama", "sci-fi", "thriller"],
    poster: "/5LoHuHWA4H8jElFlZDvsmU2n0b.jpg",
    backdrop: "/apbrbWs8M9lyOpJYU5WXrpFbk1Z.jpg",
  },
];

for (const t of TITLES) {
  db.prepare(
    `INSERT OR REPLACE INTO titles
      (id, kind, original_title, localized_title, original_language, overview,
       release_date, release_year, runtime_minutes, poster_url, backdrop_url,
       trailer_url, external_rating, external_rating_count, external_rating_source,
       metadata_provider, metadata_updated_at, metadata_verified, created_at, updated_at)
     VALUES (?, 'movie', ?, ?, 'en', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'tmdb', 'tmdb', ?, 1, ?, ?)`
  ).run(
    t.id,
    t.original,
    t.localized,
    t.overview,
    `${t.year}-01-01`,
    t.year,
    t.runtime,
    `https://image.tmdb.org/t/p/w500${t.poster}`,
    `https://image.tmdb.org/t/p/w780${t.backdrop}`,
    `https://www.youtube.com/watch?v=${t.trailer}`,
    t.rating,
    t.ratingCount,
    now,
    now,
    now
  );

  for (const g of t.genres) {
    db.prepare(
      `INSERT OR IGNORE INTO title_genres (title_id, genre_id, provider) VALUES (?, ?, 'tmdb')`
    ).run(t.id, `genre_${g}`);
  }
}

/* --- Kutuphane kayitlari --- */
const LIBRARY = [
  { titleId: "ttl_ci_inception", status: "watched", rating: 10, favorite: true, year: 2010 },
  { titleId: "ttl_ci_breaking_bad", status: "watched", rating: 9, favorite: true, year: 2008 },
  { titleId: "ttl_ci_matrix", status: "watched", rating: 9, favorite: false, year: 1999 },
  { titleId: "ttl_ci_dark", status: "watching", rating: 8, favorite: false, year: 2017 },
];

for (const lib of LIBRARY) {
  db.prepare(
    `INSERT OR REPLACE INTO library_entries
      (id, user_id, title_id, status, rating, watched_at, is_favorite, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    newId("lib"),
    anilId,
    lib.titleId,
    lib.status,
    lib.rating,
    `${lib.year}-06-15`,
    lib.favorite ? 1 : 0,
    now,
    now
  );
}

/* --- Inceleme (topluluk akisi icin) --- */
db.prepare(
  `INSERT OR REPLACE INTO reviews
    (id, user_id, title_id, body, rating, contains_spoiler, visibility, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, 0, 'public', ?, ?)`
).run(
  newId("rev"),
  anilId,
  "ttl_ci_inception",
  "Gerçekçi görüntü yönetimi ve katmanlı kurgu; izlenmeden önce bilinmesi gereken detayları spoiler saymayan bir yapım.",
  10,
  now,
  now
);

/* --- Tartisma (yanit bildirimi icin) --- */
const threadId = newId("thr");
db.prepare(
  `INSERT OR REPLACE INTO discussion_threads
    (id, title_id, user_id, heading, body, contains_spoiler, visibility, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, 0, 'public', ?, ?)`
).run(
  threadId,
  "ttl_ci_inception",
  anilId,
  "Inception hakkında",
  "Filmin katmanlı anlatısı hakkında ne düşünüyorsunuz?",
  now,
  now
);

db.prepare(
  `INSERT OR REPLACE INTO discussion_posts
    (id, thread_id, user_id, body, contains_spoiler, created_at)
   VALUES (?, ?, ?, ?, 0, ?)`
).run(
  newId("pst"),
  threadId,
  anilId,
  "Zaman katmanları çok iyi düşünülmüş.",
  now
);

/* --- Rapor (moderasyon paneli icin) --- */
db.prepare(
  `INSERT OR REPLACE INTO reports
    (id, reporter_id, target_type, target_id, reason, details, status, created_at)
   VALUES (?, ?, 'review', ?, 'spam', ?, 'open', ?)`
).run(
  newId("rep"),
  anilId,
  "rev_ci_demo",
  "CI test raporu",
  now
);

db.close();
console.log("[CI Seed] Fixture hazir.");
console.log(`  Login: anil@cinemaverse.local / admin`);
console.log(`  ${TITLES.length} yapim, ${LIBRARY.length} kutuphane kaydi, 1 inceleme, 1 tartisma, 1 rapor`);
