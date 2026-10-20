/**
 * Yapimlarin fragmanlarini Wikipedia makalelerinin dis baglantilarindan
 * (YouTube watch linkleri) derler ve titles.trailer_url alanina yazar.
 * - SADECE trailer_url IS NULL satirlara yazar; mevcut deger korunur.
 * - Her aday YouTube oEmbed ile dogrulanir (olmayan video kabul edilmez).
 * - Idempotent: tekrar kosulabilir.
 *
 *   node scripts/fetch-trailers.mjs            # dry-run
 *   node scripts/fetch-trailers.mjs --apply
 */
import Database from "better-sqlite3";

const APPLY = process.argv.includes("--apply");
const db = new Database("data/cinemaverse.db");
db.pragma("journal_mode = WAL");
const nowIso = () => new Date().toISOString();
const headers = { "User-Agent": "CinemaVerse-local/1.0" };

const titles = db
  .prepare(
    `SELECT t.id AS title_id, t.wikidata_id AS wd, t.original_title AS orijinal,
            t.localized_title AS yerel,
            COALESCE(t.localized_title, t.original_title) AS ad
     FROM titles t
     WHERE t.kind IN ('movie', 'series')
       AND (t.trailer_url IS NULL OR t.trailer_url = '')
     ORDER BY t.id`
  )
  .all();
console.log("Aday (trailer'siz) yapim:", titles.length);

/* --- wikidata sitelinkleri ------------------------------------------- */
async function sitelinkMap(qids) {
  if (qids.length === 0) return {};
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

function normName(s) {
  return (s ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
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
  try {
    const res = await fetch(url, { headers });
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

async function extlinks(pageTitle, lang) {
  const host = lang === "en" ? "en.wikipedia.org" : "tr.wikipedia.org";
  const url =
    `https://${host}/w/api.php?action=query&format=json&redirects=1` +
    `&prop=extlinks&ellimit=100&titles=${encodeURIComponent(pageTitle.replace(/ /g, "_"))}`;
  let links = [];
  try {
    const res = await fetch(url, { headers });
    if (res.ok) {
      const body = await res.json();
      const first = Object.values(body?.query?.pages ?? {})[0];
      links = (first?.extlinks ?? []).map((e) => Object.values(e)[0]).map(String);
    }
  } catch {
    links = [];
  }
  await new Promise((r) => setTimeout(r, 350));
  return links;
}

/** YouTube oEmbed ile linkin gercekten var olan bir video oldugunu dogrular. */
async function youtubeValid(url) {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { headers }
    );
    if (!res.ok) return null;
    const body = await res.json();
    return body.title ?? null;
  } catch {
    return null;
  }
}

function youtubeWatchLinks(links) {
  const out = [];
  for (const raw of links) {
    const url = raw.startsWith("//") ? `https:${raw}` : raw;
    let m = url.match(/youtube\.com\/watch\?v=([\w-]{6,})/i);
    if (m) {
      out.push({ url: `https://www.youtube.com/watch?v=${m[1]}` });
      continue;
    }
    m = url.match(/youtu\.be\/([\w-]{6,})/i);
    if (m) {
      out.push({ url: `https://www.youtube.com/watch?v=${m[1]}` });
      continue;
    }
    m = url.match(/youtube\.com\/embed\/([\w-]{6,})/i);
    if (m) {
      out.push({ url: `https://www.youtube.com/watch?v=${m[1]}` });
      continue;
    }
  }
  return out;
}

/* --- ana akis --------------------------------------------------------- */
const withWd = titles.filter((t) => t.wd);
const qidToSites = {};
for (let i = 0; i < withWd.length; i += 40) {
  Object.assign(qidToSites, await sitelinkMap(withWd.slice(i, i + 40).map((t) => t.wd)));
  await new Promise((r) => setTimeout(r, 400));
}

const update = db.prepare(
  "UPDATE titles SET trailer_url = ?, updated_at = ? WHERE id = ? AND (trailer_url IS NULL OR trailer_url = '')"
);

let found = 0;
let checked = 0;

for (const t of titles) {
  checked += 1;
  const sites = t.wd ? (qidToSites[t.wd] ?? null) : null;

  for (const lang of ["en", "tr"]) {
    const page =
      sites?.[lang] ??
      (await searchPage(lang === "en" ? t.orijinal ?? t.ad : t.yerel ?? t.ad, lang));
    if (!page) continue;
    const links = await extlinks(page, lang);
    const candidates = youtubeWatchLinks(links);
    if (candidates.length === 0) continue;

    // ilk dogrulayilan videoyu kabul et
    let chosen = null;
    for (const c of candidates.slice(0, 3)) {
      const title = await youtubeValid(c.url);
      if (title) {
        chosen = { url: c.url, title, source: `https://${lang === "en" ? "en" : "tr"}.wikipedia.org/wiki/${page.replace(/ /g, "_")}` };
        break;
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    if (chosen) {
      console.log(" +", (t.ad ?? "?").slice(0, 40), "->", chosen.title.slice(0, 50));
      if (APPLY) update.run(chosen.url, nowIso(), t.title_id);
      found += 1;
      break;
    }
  }
}

console.log(
  APPLY
    ? `Bitti: ${found}/${checked} yapim icin fragman kaydedildi.`
    : `Dry-run: ${found}/${checked} yapim icin fragman bulunabilir.`
);
db.close();
