/**
 * Yapimlarin Wikipedia (TR + EN) makalelerindeki elestiri/reception
 * bolumlerindeki yorum cumlelerini external_comments tablosuna derler.
 *
 * - Ucretsiz ve yasal (Wikipedia CC BY-SA; attribution source_url ile tutulur).
 * - SADECE kind movie/series satirlari taranir; kullanici verisi degismez.
 * - Idempotent: contentHash ayniyse yeniden eklenmez.
 *
 *   node scripts/fetch-external-comments.mjs --apply
 */
import Database from "better-sqlite3";
import { createHash } from "node:crypto";

const APPLY = process.argv.includes("--apply");
const db = new Database("data/cinemaverse.db");
db.pragma("journal_mode = WAL");
const nowIso = () => new Date().toISOString();

const headers = { "User-Agent": "CinemaVerse-local/1.0 (ozel kullanim; anil@cinemaverse.local)" };

const titles = db
  .prepare(
    `SELECT t.id AS title_id, t.wikidata_id AS wd, t.tvmaze_id AS tvm,
            t.original_title AS orijinal, t.localized_title AS yerel,
            COALESCE(t.localized_title, t.original_title) AS ad
     FROM titles t
     WHERE t.kind IN ('movie', 'series')
     ORDER BY t.id`
  )
  .all();
console.log("Taranacak yapim:", titles.length);

/* ---------------- yardimci fonksiyonlar ---------------- */

async function sitelinkMap(qids) {
  const url =
    `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json` +
    `&props=sitelinks&sitefilter=enwiki|trwiki&ids=${qids.join("|")}`;
  const res = await fetch(url, { headers });
  if (!res.ok) return {};
  const body = await res.json();
  const map = {};
  for (const [qid, ent] of Object.entries(body.entities ?? {})) {
    map[qid] = {
      en: ent.sitelinks?.enwiki?.title ?? null,
      tr: ent.sitelinks?.trwiki?.title ?? null,
    };
  }
  return map;
}

/** Isim aramasi ile wiki makalesi bulur (wikidata'siz yapimlar icin fallback). */
function normName(s) {
  return (s ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const fallbackCache = new Map();

async function searchPage(name, lang) {
  if (!name || name.trim().length < 3) return null;
  const key = `${lang}:${normName(name)}`;
  if (fallbackCache.has(key)) return fallbackCache.get(key);
  const host = lang === "en" ? "en.wikipedia.org" : "tr.wikipedia.org";
  const url =
    `https://${host}/w/api.php?action=query&format=json&list=search` +
    `&srsearch=${encodeURIComponent(name)}&srlimit=3`;
  let page = null;
  let res;
  try {
    res = await fetch(url, { headers });
    if (res.ok) {
      const body = await res.json();
      const hits = body?.query?.search ?? [];
      const wanted = normName(name);
      const hit = hits.find((h) => {
        const t = normName(h.title);
        return t === wanted || t.startsWith(wanted) || wanted.startsWith(`${t} `);
      });
      if (hit) page = hit.title;
    }
  } catch {
    page = null;
  }
  fallbackCache.set(key, page);
  await new Promise((r) => setTimeout(r, 300));
  return page;
}

async function wikitext(pageTitle, site) {
  const host = site === "en" ? "en.wikipedia.org" : "tr.wikipedia.org";
  const url =
    `https://${host}/w/api.php?action=query&format=json&redirects=1` +
    `&prop=revisions&rvprop=content&rvslots=main&titles=${encodeURIComponent(
      pageTitle.replace(/ /g, "_")
    )}`;
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  const body = await res.json();
  const pages = body?.query?.pages ?? {};
  const first = Object.values(pages)[0];
  const text = first?.revisions?.[0]?.slots?.main?.["*"] ?? null;
  return text;
}

/** === Basligi bulur ve ayni/buyuk seviye bir sonraki basliga kadar alir. */
function extractSection(wikitext, headerRegex) {
  const lines = wikitext.split("\n");
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(/^(={2,4})\s*(.+?)\s*\1\s*$/);
    if (!m) continue;
    if (start >= 0 && m[1].length <= level) return lines.slice(start, i).join("\n");
    if (start === -1 && headerRegex.test(m[2])) {
      start = i + 1;
      level = m[1].length;
    }
  }
  if (start >= 0) return lines.slice(start).join("\n");
  return null;
}

function scrub(text) {
  let out = text;
  // madde basliklari (=== Viewership === gibi) tamamen atilir
  out = out.replace(/^={2,4}[^=\n]*={2,4}$/gm, " ");
  out = out.replace(/<ref[^>]*\/>/g, " ");
  out = out.replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, " ");
  out = out.replace(/<!--[\s\S]*?-->/g, " ");
  for (let i = 0; i < 6; i += 1) out = out.replace(/\{\{[^{}]*\}\}/g, " ");
  out = out.replace(/<[^>]+>/g, " ");
  out = out.replace(/\[\[(?:[^[\]|]*\|)?([^\[\]|]*)\]\]/g, "$1");
  out = out.replace(/'{2,5}/g, "");
  out = out.replace(/&nbsp;/g, " ");
  out = out.replace(/[ \t]+/g, " ");
  out = out.replace(/\n+/g, "\n");
  return out.trim();
}

const REVIEW_HINT_EN =
  /(review|critic|praise|acclaim|mixed|negative|positive|appeal|audience|rotten|metacritic|affectionat|shark|praised|criticized|reaction|reception|aggregat|rating|score)/i;
const REVIEW_HINT_TR =
  /(eleştir|tepk|kritik|beğen|övgü|izleyici|reklam|gösterim|gişe|puan|değerlendir|önemli|yorum)/iu;

function sentences(text, hint) {
  const flat = text.replace(/\n+/g, " ");
  const parts = flat.split(/(?<=[.!?…])\s+/);
  const out = [];
  for (let s of parts) {
    s = s.trim();
    if (s.length < 45 || s.length > 420) continue;
    if (/[{<>|}]/.test(s)) continue;
    if ((s.match(/(https?:\/\/)/g) ?? []).length) continue;
    if (!hint.test(s)) continue;
    out.push(s);
  }
  return out;
}

const hash = (s) =>
  createHash("sha1").update(s.toLowerCase().replace(/\s+/g, " ")).digest("hex");

/* ---------------- ana akis ---------------- */

const qidToSites = {};
const withWd = titles.filter((t) => t.wd);
for (let i = 0; i < withWd.length; i += 40) {
  const chunk = withWd.slice(i, i + 40);
  Object.assign(qidToSites, await sitelinkMap(chunk.map((t) => t.wd)));
  await new Promise((r) => setTimeout(r, 400));
  if ((i / 40) % 4 === 3) console.log(`... sitelink ${i + 40}/${withWd.length}`);
}
console.log(
  `wikidata'li: ${withWd.length}, en/tr makalesi: ${
    Object.values(qidToSites).filter((v) => v.en || v.tr).length
  } (geri kalanlar isim aramasiyla taranacak)`
);

const PLAN = titles.map((t) => ({ ...t, sites: qidToSites[t.wd] ?? null }));
const insert = db.prepare(
  `INSERT INTO external_comments
     (id, title_id, source, source_url, author, section, language, body, content_hash, created_at)
   VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`
);

let total = 0;
let articlesScanned = 0;
const skippedExisting = db.prepare(
  `SELECT content_hash FROM external_comments WHERE title_id = ?`
);

for (const t of PLAN) {
  const existing = new Set(skippedExisting.all(t.title_id).map((r) => r.content_hash));
  const rows = [];

  for (const lang of ["en", "tr"]) {
    const page =
      t.sites?.[lang] ??
      (await searchPage(lang === "en" ? t.orijinal ?? t.ad : t.yerel ?? t.ad, lang));
    if (!page) continue;
    const wt = await wikitext(page, lang);
    if (!wt) continue;
    const rx =
      lang === "en"
        ? /critical reception|reception|critical response/i
        : /eleştir|tepkiler|kritik/i;
    const raw = extractSection(wt, rx);
    if (!raw) continue;
    const sectionName =
      lang === "en" ? "Reception" : "Eleştiriler / Tepkiler";
    const cleaned = scrub(raw);
    if (cleaned.length < 60) continue;
    articlesScanned += 1;

    const found = sentences(
      cleaned,
      lang === "en" ? REVIEW_HINT_EN : REVIEW_HINT_TR
    );
    for (const s of found) {
      const h = hash(s);
      if (existing.has(h)) continue;
      existing.add(h);
      rows.push({
        source: lang === "en" ? "wikipedia-en" : "wikipedia-tr",
        url:
          (lang === "en" ? "https://en.wikipedia.org/wiki/" : "https://tr.wikipedia.org/wiki/") +
          page.replace(/ /g, "_"),
        section: sectionName,
        language: lang,
        body: s,
        contentHash: h,
      });
    }
    await new Promise((r) => setTimeout(r, 350));
  }

  if (rows.length && APPLY) {
    for (const r of rows) {
      insert.run(
        `ext_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`,
        t.title_id,
        r.source,
        r.url,
        r.section,
        r.language,
        r.body,
        r.contentHash,
        nowIso()
      );
    }
  }
  total += rows.length;
}

console.log(
  APPLY
    ? `Bitti: ${total} yeni yorum eklendi (${articlesScanned} makale bolumu tarandi).`
    : `Dry-run: ${total} yorum eklenebilirdi (${articlesScanned} makale bolumu).`
);
db.close();
