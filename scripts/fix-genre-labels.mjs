/**
 * genres tablosunda adi ham Wikidata kimligi (Q123) kalan kayitlari
 * gercek tur adlariyla degistirir.
 *
 *   node scripts/fix-genre-labels.mjs            # dry-run
 *   node scripts/fix-genre-labels.mjs --apply    # yaz
 *
 * Ad cozum sirasi: en etiketi -> tr etiketi -> enwiki/trwiki basligi
 * -> herhangi bir dildeki etiket. Hicbiri yoksa kayit oldugu gibi kalir.
 * cozulen turlerin slug'i da (q123456 -> bilim-kurgu) yenilenir.
 */
import Database from "better-sqlite3";

const APPLY = process.argv.includes("--apply");
const API = "https://www.wikidata.org/w/api.php";
const UA = "CinemaVerse/1.0 (local-first film gunlugu)";

const db = new Database("data/cinemaverse.db");
db.pragma("journal_mode = WAL");

const TR_MAP = {
  ç: "c",
  ğ: "g",
  ı: "i",
  ö: "o",
  ş: "s",
  ü: "u",
  â: "a",
  î: "i",
  û: "u",
};

function slugify(value) {
  return value
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşüâîû]/g, (char) => TR_MAP[char] ?? char)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const rows = db
  .prepare(
    "select id, slug, name_tr, name_en from genres where name_tr glob 'Q[0-9]*' or name_en glob 'Q[0-9]*'",
  )
  .all();

console.log("Ham kimlikli tur:", rows.length);
if (rows.length === 0) process.exit(0);

const qids = [...new Set(rows.map((row) => row.name_en))].filter((value) =>
  /^Q\d+$/.test(value),
);
console.log("Benzersiz kimlik:", qids.length);

const resolved = new Map();
for (let i = 0; i < qids.length; i += 45) {
  const chunk = qids.slice(i, i + 45);
  const url =
    `${API}?action=wbgetentities&format=json` +
    `&props=labels|sitelinks&sitefilter=enwiki|trwiki` +
    `&ids=${chunk.join("|")}`;
  let data;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = await response.json();
  } catch (error) {
    console.log(` ! ${chunk[0]}... grubu alinamadi: ${error.message}`);
    continue;
  }

  for (const [qid, entity] of Object.entries(data.entities ?? {})) {
    const labels = entity.labels ?? {};
    const sitelinks = entity.sitelinks ?? {};
    const pick = (value) =>
      typeof value === "string" && value.trim() && !/^Q\d+$/.test(value)
        ? value.trim()
        : null;
    const nameEn =
      pick(labels.en?.value) ??
      pick(sitelinks.enwiki?.title) ??
      pick(
        Object.values(labels).find((entry) => pick(entry?.value))?.value,
      );
    const nameTr =
      pick(labels.tr?.value) ?? pick(sitelinks.trwiki?.title) ?? nameEn;
    if (nameEn) resolved.set(qid, { nameEn, nameTr: nameTr ?? nameEn });
  }

  await new Promise((resolve) => setTimeout(resolve, 300));
}

console.log("Cozulen:", resolved.size, "/", qids.length);

const usedSlugs = new Set(
  db
    .prepare("select slug from genres")
    .all()
    .map((row) => row.slug),
);

const update = db.prepare(
  "update genres set name_en = ?, name_tr = ?, slug = ? where id = ?",
);
let renamed = 0;

db.transaction(() => {
  for (const row of rows) {
    const names = resolved.get(row.name_en);
    if (!names) continue;
    let slug = row.slug;
    if (/^q\d+$/.test(slug)) {
      const base = slugify(names.nameEn) || row.slug;
      slug = base;
      let suffix = 2;
      while (usedSlugs.has(slug)) slug = `${base}-${suffix++}`;
    }
    usedSlugs.add(slug);
    console.log(
      ` + ${row.name_tr} -> ${names.nameTr} / ${names.nameEn} (${slug})`,
    );
    if (APPLY) update.run(names.nameEn, names.nameTr, slug, row.id);
    renamed += 1;
  }
})();

console.log(
  APPLY
    ? `Bitti: ${renamed} tur guncellendi.`
    : `Dry-run: ${renamed} tur guncellenebilir.`,
);
db.close();
