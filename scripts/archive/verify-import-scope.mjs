/**
 * Ice aktarim sonrasi kapsam dogrulamasi (salt okunur).
 * Kullanim: node scripts/verify-import-scope.mjs
 */
import Database from "better-sqlite3";
import path from "node:path";

const dbPath = process.env.DATABASE_PATH?.trim() || "./data/cinemaverse.db";
const db = new Database(path.resolve(dbPath), { readonly: true });

const user = db
  .prepare(`select id, email, display_name, role from users where display_name = 'Anıl'`)
  .get();
if (!user) {
  console.error("HATA: 'Anıl' kullanıcısı bulunamadı");
  process.exit(1);
}
console.log(`Hedef kullanici: ${user.id} | ${user.email} | "${user.display_name}" | role=${user.role}\n`);

const rows = db
  .prepare(
    `select le.id, le.status, le.rating, le.is_favorite, le.notes, le.liked_aspects,
            t.id as title_id, t.kind, t.original_title, t.localized_title, t.release_year,
            t.season_number, t.parent_id
       from library_entries le
       join titles t on t.id = le.title_id
      where le.user_id = ?
      order by t.kind, t.release_year, t.original_title`,
  )
  .all(user.id);

console.log(`Toplam kutuphane kaydi: ${rows.length}\n`);

const find = (needle) =>
  rows.filter((r) =>
    `${r.original_title} ${r.localized_title ?? ""}`
      .toLowerCase()
      .includes(needle.toLowerCase()),
  );

/* 1. Franchise puanlari tekil filmlere dagitilmadi mi? */
console.log("=== 1) FRANCHISE KAPSAMI ===");
const franchises = rows.filter((r) => r.kind === "franchise");
console.log(`Franchise kaydi: ${franchises.length}`);
for (const f of franchises) {
  console.log(
    `   ${f.original_title.padEnd(30)} puan=${f.rating} | ${f.title_id}`,
  );
}
const franchiseNames = franchises.map((f) => f.original_title);
const leaked = rows.filter(
  (r) =>
    r.kind === "movie" &&
    franchiseNames.some((n) => n.toLowerCase() === r.original_title.toLowerCase()),
);
console.log(
  `  -> Franchise adiyla ayni tekil film kaydi (dagitim kaniti): ${leaked.length}`,
);
for (const l of leaked) console.log(`     ! ${l.original_title} puan=${l.rating}`);

/* 2. Sezon puani diziye kopyalanmadi mi? */
console.log("\n=== 2) SEZON KAPSAMI ===");
const seasons = rows.filter((r) => r.kind === "season");
for (const s of seasons) {
  const parent = rows.find((r) => r.title_id === s.parent_id);
  console.log(
    `   ${s.original_title} (sezon ${s.season_number}) puan=${s.rating} | yil=${s.release_year}`,
  );
  console.log(
    `      parent dizi: ${parent ? `${parent.original_title} puan=${parent.rating}` : "dizi kaydi YOK (dogru)"}`,
  );
}

/* 3. Dexter / Dexter: New Blood ayri mi? */
console.log("\n=== 3) AYRI TUTULMASI GEREKEN CIFTLER ===");
for (const [a, b] of [
  ["Dexter", "Dexter: New Blood"],
  ["The Matrix", "The Matrix Reloaded"],
  ["Shameless", "Utopia"],
  ["Taxi", "The Cube"],
]) {
  const ra = find(a);
  const rb = find(b);
  console.log(`   "${a}" -> ${ra.map((r) => `${r.original_title}(${r.kind},${r.rating})`).join(", ") || "-"}`);
  console.log(`   "${b}" -> ${rb.map((r) => `${r.original_title}(${r.kind},${r.rating})`).join(", ") || "-"}`);
}

/* 4. Ozel durumlu kayitlar */
console.log("\n=== 4) OZEL DURUMLU KAYITLAR ===");
for (const [name, expected] of [
  ["2012", "watched + puansiz"],
  ["Person of Interest", "watching (yarim)"],
  ["Suits", "unsure (belirsiz)"],
  ["True Detective", "sezon puani"],
]) {
  const hits = find(name);
  for (const h of hits) {
    console.log(
      `   ${h.original_title.padEnd(28)} kind=${h.kind.padEnd(9)} status=${h.status.padEnd(12)} puan=${h.rating ?? "null"} | beklenen: ${expected}`,
    );
  }
}

/* 5. Puanlilarda puan null olmamali, puanlilarda olmayanda puan olmamali */
console.log("\n=== 5) Puan TUTARLILIGI ===");
const ratedNull = rows.filter((r) => r.rating === null);
const unratedWithScore = rows.filter(
  (r) => r.rating !== null && r.status === "not_watched",
);
console.log(`   Puani null olan kayit sayisi: ${ratedNull.length}`);
console.log(`   Izlenmemis olup puani olan kayit: ${unratedWithScore.length}`);
for (const u of unratedWithScore) {
  console.log(`     ! ${u.original_title} status=${u.status} puan=${u.rating}`);
}

/* 6. Tercih profili */
console.log("\n=== 6) TERCIPH PROFILI ===");
const profile = db
  .prepare(`select profile_json, confidence, rated_title_count from preference_profiles where user_id = ?`)
  .get(user.id);
if (!profile) {
  console.log("   HATA: tercih profili yok");
} else {
  const json = JSON.parse(profile.profile_json);
  console.log(`   rated_title_count=${profile.rated_title_count} confidence=${profile.confidence}`);
  console.log(`   alan sayisi: ${Object.keys(json).length}`);
  for (const key of [
    "recommendationCourage",
    "cultDiscovery",
    "genres",
    "coreTasteDimensions",
    "engineDimensions",
    "tempo",
    "spoilers",
    "recommendationsOnlyOnRequest",
    "doNotRecommendAlreadyWatched",
    "trueDetectiveS1LikedAspects",
    "trueDetectiveS1Limitation",
    "unknownDataPolicy",
    "ratingScopePolicy",
  ]) {
    console.log(`   ${key}: ${JSON.stringify(json[key])}`);
  }
}

/* 7. Favorite isaretleri */
console.log("\n=== 7) FAVORI ISARETLERI (acikca sevilenler) ===");
const favs = rows.filter((r) => r.is_favorite);
console.log(`   Toplam favori: ${favs.length} (kaynakta 26)`);
for (const f of favs.slice(0, 30)) {
  console.log(`   - ${f.original_title}`);
}

/* 8. Diger kullanicilar etkilenmis mi? */
console.log("\n=== 8) DIGER KULLANICILAR ===");
const others = db
  .prepare(`select user_id, count(*) c from library_entries where user_id <> ? group by user_id`)
  .all(user.id);
console.log(`   Etkilenen baska kullanici: ${others.length}`);
console.log(
  `   Toplam kayit: ${others.reduce((s, o) => s + Number(o.c), 0)} (aktarim oncesi 9)`,
);

/* 9. Kaynak dosyalar degismemis mi? */
console.log("\n=== 9) KAYNAK DOSYALAR ===");
import fs from "node:fs";
const src = path.resolve("anıl");
for (const f of [
  "cinemaverse_personal_memory_import.json",
  "cinemaverse_scored_titles.csv",
  "cinemaverse_watch_statuses.csv",
]) {
  const st = fs.statSync(path.join(src, f));
  console.log(`   ${f} — ${st.size} byte — degistirilme: ${st.mtime.toISOString()}`);
}

db.close();
