import Database from "better-sqlite3";
const db = new Database("data/cinemaverse.db", { readonly: true });
const q = (sql, ...params) => db.prepare(sql).all(...params);
const anilId = "usr_bf242909977947f5899828fc";

console.log("=== ANİL KÜTÜPHANE ===");
const lib = q(`
  SELECT le.*, t.kind, t.original_title, t.localized_title, t.release_year, t.runtime_minutes,
         t.external_rating, t.overview,
         (SELECT g.slug FROM title_genres tg JOIN genres g ON tg.genre_id = g.id WHERE tg.title_id = t.id LIMIT 1) AS genre1
  FROM library_entries le
  JOIN titles t ON le.title_id = t.id
  WHERE le.user_id = ? AND le.status = 'watched'
`, anilId);
console.log("Izlenen sayisi:", lib.length);

const years = {};
const genres = {};
const totalMin = { total: 0 };
lib.forEach(r => {
  if (r.release_year) years[r.release_year] = (years[r.release_year] || 0) + 1;
  if (r.genre1) genres[r.genre1] = (genres[r.genre1] || 0) + 1;
  if (r.runtime_minutes) totalMin.total += r.runtime_minutes;
});
console.log("Yil dagilimi:", Object.entries(years).sort((a,b)=>b[1]-a[1]).slice(0,10));
console.log("Tur dagilimi:", Object.entries(genres).sort((a,b)=>b[1]-a[1]).slice(0,10));
console.log("Toplam dakika:", totalMin.total, "~", Math.round(totalMin.total/60), "saat");

console.log("\n=== ÖZET (overview) sayisi ===");
const overviews = q(`SELECT COUNT(*) c FROM titles WHERE overview IS NOT NULL AND overview != '' AND kind IN ('movie','series')`);
console.log(overviews[0].c);

console.log("\n=== AI model/konfig ===");
console.log(q("SELECT key, value FROM app_config WHERE key LIKE 'ai_%' OR key LIKE 'ollama_%'"));

db.close();