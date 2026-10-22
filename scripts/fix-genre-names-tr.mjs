/**
 * Ana sayfadaki tur satirlarinda gorunen Ingilizce tur adlarini Turkceye cevirir.
 * Yalnizca name_tr === name_en olan (yani Turkce karsiligi hic yazilmamis)
 * kayitlara dokunur; elle cevrilmis adlar korunur.
 *
 *   node scripts/fix-genre-names-tr.mjs            # dry-run
 *   node scripts/fix-genre-names-tr.mjs --apply    # yaz
 */
import Database from "better-sqlite3";

const APPLY = process.argv.includes("--apply");

/** slug -> Turkce ad (yalnizca gorunen satirlar) */
const NAMES_TR = {
  dystopian: "Distopya",
  "children-s": "Çocuk",
  "crime-thriller": "Suç Gerilimi",
  cyberpunk: "Siberpunk",
  "post-apocalyptic": "Kıyamet Sonrası",
  "speculative-fiction": "Spekülatif Kurgu",
  supernatural: "Doğaüstü",
  suspense: "Suspans",
  "time-travel": "Zaman Yolculuğu",
};

const db = new Database("data/cinemaverse.db");
db.pragma("journal_mode = WAL");

const update = db.prepare("update genres set name_tr = ? where id = ?");
let changed = 0;

db.transaction(() => {
  for (const [slug, nameTr] of Object.entries(NAMES_TR)) {
    const row = db
      .prepare("select id, name_tr, name_en from genres where slug = ?")
      .get(slug);
    if (!row) {
      console.log(` ! ${slug} bulunamadi`);
      continue;
    }
    if (row.name_tr !== row.name_en) {
      console.log(` = ${slug}: zaten Turkce (${row.name_tr})`);
      continue;
    }
    if (row.name_tr === nameTr) continue;
    console.log(` + ${row.name_tr} -> ${nameTr}`);
    if (APPLY) update.run(nameTr, row.id);
    changed += 1;
  }
})();

console.log(
  APPLY
    ? `Bitti: ${changed} tur adi guncellendi.`
    : `Dry-run: ${changed} tur adi guncellenebilir.`,
);
db.close();
