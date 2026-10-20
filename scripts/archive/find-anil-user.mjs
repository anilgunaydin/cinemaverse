/**
 * "Anil" hedef kullanici aramasi (salt okunur).
 * Kullanim: node scripts/find-anil-user.mjs
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dbPath = process.env.DATABASE_PATH?.trim() || "./data/cinemaverse.db";
const resolved = path.resolve(dbPath);
console.log(`DB: ${resolved}`);
console.log(`DB var mi: ${fs.existsSync(resolved)}`);

const db = new Database(resolved, { readonly: true });

console.log("\n=== display_name LIKE aramalari ===");
const queries = [
  ["anil (ASCII)", "anil"],
  ["anıl (U+0131)", "anıl"],
  ["anil Turkce harf duyarsiz", "anıIıIlL"],
];
for (const [label, pattern] of queries) {
  const rows = db
    .prepare(
      `select id, email, display_name, role from users
       where lower(display_name) like ? or lower(email) like ?
       order by created_at`,
    )
    .all(`%${pattern.toLowerCase()}%`, `%${pattern.toLowerCase()}%`);
  console.log(`[${label}] ${rows.length} sonuc`);
  for (const r of rows) {
    console.log(`   ${r.id} | ${r.email} | "${r.display_name}" | ${r.role}`);
  }
}

// Turkce harf normalizasyonu ile genis arama
function normalize(s) {
  return s
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

console.log("\n=== normalize edilmis 'anil' eslesmesi ===");
const all = db.prepare(`select id, email, display_name, role, created_at from users order by created_at`).all();
for (const u of all) {
  const hay = `${normalize(u.display_name)} ${normalize(u.email)}`;
  if (hay.includes("anil") || hay.includes("anil")) {
    console.log(`  ESLESME: ${u.id} | ${u.email} | "${u.display_name}" | ${u.role} | ${u.created_at}`);
  }
}

console.log(`\nToplam kullanici: ${all.length}`);
console.log("\n=== benzersiz display_name'ler ===");
console.log([...new Set(all.map((u) => u.display_name))].join(" | "));

console.log("\n=== benzersiz email domain'leri ===");
console.log([...new Set(all.map((u) => u.email.split("@")[1]))].join(" | "));

db.close();

// Diger olasi DB dosyalari
console.log("\n=== data/ klasorundeki dosyalar ===");
const dataDir = path.resolve("./data");
if (fs.existsSync(dataDir)) {
  for (const f of fs.readdirSync(dataDir)) {
    const st = fs.statSync(path.join(dataDir, f));
    console.log(`  ${f} — ${st.size} byte — ${st.mtime.toISOString()}`);
  }
} else {
  console.log("  (yok)");
}

console.log("\n=== proje genelinde .db / .sqlite dosyalari ===");
function walk(dir, depth = 0) {
  if (depth > 4) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === ".next" || e.name === ".git") continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, depth + 1);
    else if (/\.(db|sqlite3?|sqlite)$/i.test(e.name)) {
      console.log(`  ${full} — ${fs.statSync(full).size} byte`);
    }
  }
}
walk(path.resolve("."));
