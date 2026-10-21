/**
 * people.name alaninda ham Wikidata kimligi (Q123) kalan kayitlari
 * gercek adlarla degistirir.
 *
 *   node scripts/fix-person-labels.mjs            # dry-run
 *   node scripts/fix-person-labels.mjs --apply    # yaz
 *
 * Ad cozum sirasi: en etiketi -> tr etiketi -> enwiki/trwiki basligi
 * -> herhangi bir dildeki etiket. Hicbiri yoksa kayit oldugu gibi kalir.
 */
import Database from "better-sqlite3";

const APPLY = process.argv.includes("--apply");
const API = "https://www.wikidata.org/w/api.php";
const UA = "CinemaVerse/1.0 (local-first film gunlugu)";

const db = new Database("data/cinemaverse.db");
db.pragma("journal_mode = WAL");

const rows = db
  .prepare("select id, name, wikidata_id from people where name glob 'Q[0-9]*'")
  .all();

console.log("Ham kimlikli kisi:", rows.length);
if (rows.length === 0) process.exit(0);

const byQid = new Map();
for (const row of rows) {
  const qid = /^Q\d+$/.test(row.wikidata_id ?? "") ? row.wikidata_id : row.name;
  if (!byQid.has(qid)) byQid.set(qid, []);
  byQid.get(qid).push(row);
}
console.log("Benzersiz kimlik:", byQid.size);

const qids = [...byQid.keys()];
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
    const name =
      labels.en?.value ??
      labels.tr?.value ??
      sitelinks.trwiki?.title ??
      sitelinks.enwiki?.title ??
      Object.values(labels).find(
        (entry) => typeof entry?.value === "string" && entry.value.trim(),
      )?.value ??
      null;
    if (name && !/^Q\d+$/.test(name)) resolved.set(qid, name.trim());
  }

  await new Promise((resolve) => setTimeout(resolve, 300));
}

console.log("Cozulen:", resolved.size, "/", qids.length);

const update = db.prepare("update people set name = ? where id = ?");
let renamed = 0;
const skipped = [];

db.transaction(() => {
  for (const [qid, name] of resolved) {
    for (const person of byQid.get(qid)) {
      if (person.name === name) continue;
      console.log(` + ${person.name} -> ${name}`);
      if (APPLY) update.run(name, person.id);
      renamed += 1;
    }
  }
  for (const qid of qids) {
    if (!resolved.has(qid)) skipped.push(qid);
  }
})();

console.log(
  APPLY
    ? `Bitti: ${renamed} kayit guncellendi.`
    : `Dry-run: ${renamed} kayit guncellenebilir.`,
);
if (skipped.length > 0) {
  console.log("Adi bulunamayan kimlikler:", skipped.join(", "));
}
db.close();
