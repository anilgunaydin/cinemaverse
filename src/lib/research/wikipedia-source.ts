import "server-only";

import { providerFetchJson } from "@/lib/providers/http";
import { detectSpoilerRisk, type SpoilerRisk } from "@/lib/spoilers/risk";

/**
 * Wikipedia'dan kaynak temelli "eleştiri/alımlama" bolumlerini cikarir.
 *
 * Telif: Wikipedia metni CC BY-SA lisanslidir. Bu yuzden TAM METIN
 * saklanmaz; yalnizca kisa bir alinti (<= 700 karakter) + kaynak baglantisi
 * + lisans notu saklanir ve gosterilir.
 */

export type ResearchSourceItem = {
  sourceName: string;
  sourceUrl: string;
  heading: string | null;
  excerpt: string;
  author: string | null;
  publishedAt: string | null;
  licenseNote: string;
  spoilerRisk: SpoilerRisk;
};

const EXCERPT_LIMIT = 700;

/** Degerlendirme/alimlama ile ilgili bolum basliklari. */
const RELEVANT_HEADING = /(reception|critical|critic|review|response|analysis|themes|legacy|influence|controvers|acclaim|eleştiri|değerlendirme|tepki|analiz|tema|miras|ödül)/i;

type WikipediaSection = { heading: string | null; text: string };

function splitSections(extract: string): WikipediaSection[] {
  const lines = extract.split("\n");
  const sections: WikipediaSection[] = [];
  let current: WikipediaSection = { heading: null, text: "" };

  for (const line of lines) {
    const match = /^(={2,6})\s*(.+?)\s*\1\s*$/.exec(line);
    if (match) {
      if (current.text.trim().length > 0) sections.push(current);
      current = { heading: match[2].trim(), text: "" };
    } else {
      current.text += `${line}\n`;
    }
  }
  if (current.text.trim().length > 0) sections.push(current);
  return sections;
}

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export async function fetchWikipediaSections(
  articleTitle: string,
  language: "tr" | "en",
): Promise<{ articleUrl: string; items: ResearchSourceItem[] } | null> {
  const base = `https://${language}.wikipedia.org`;
  const url =
    `${base}/w/api.php?action=query&prop=extracts&explaintext=1` +
    `&exsectionformat=wiki&redirects=1&format=json&formatversion=2` +
    `&titles=${encodeURIComponent(articleTitle)}`;

  let data: {
    query?: {
      pages?: { title?: string; extract?: string; missing?: boolean }[];
    };
  };
  try {
    ({ data } = await providerFetchJson<{
      query?: {
        pages?: { title?: string; extract?: string; missing?: boolean }[];
      };
    }>({
      provider: "wikipedia",
      url,
      cacheTtlSeconds: 60 * 60 * 24 * 7,
    }));
  } catch {
    return null;
  }

  const page = data.query?.pages?.[0];
  if (!page || page.missing || !page.extract) return null;

  const articleUrl = `${base}/wiki/${encodeURIComponent(
    (page.title ?? articleTitle).replace(/ /g, "_"),
  )}`;

  const sections = splitSections(page.extract);
  const items: ResearchSourceItem[] = [];

  for (const section of sections) {
    const excerpt = collapse(section.text);
    if (excerpt.length < 120) continue;

    const heading = section.heading;
    const relevant = heading === null || RELEVANT_HEADING.test(heading);
    if (!relevant) continue;

    items.push({
      sourceName: "Wikipedia",
      sourceUrl: heading
        ? `${articleUrl}#${encodeURIComponent(heading.replace(/ /g, "_"))}`
        : articleUrl,
      heading: heading ?? "Genel bakış",
      excerpt: excerpt.slice(0, EXCERPT_LIMIT),
      author: null,
      publishedAt: null,
      licenseNote: "Wikipedia, CC BY-SA 4.0 (yalnızca kısa alıntı)",
      spoilerRisk: detectSpoilerRisk(excerpt),
    });
  }

  // Onemli bolum bulunamazsa, en azindan giris metnini kaynak olarak sun.
  if (items.length === 0) {
    const lead = collapse(sections[0]?.text ?? "");
    if (lead.length >= 120) {
      items.push({
        sourceName: "Wikipedia",
        sourceUrl: articleUrl,
        heading: "Giriş",
        excerpt: lead.slice(0, EXCERPT_LIMIT),
        author: null,
        publishedAt: null,
        licenseNote: "Wikipedia, CC BY-SA 4.0 (yalnızca kısa alıntı)",
        spoilerRisk: detectSpoilerRisk(lead),
      });
    }
  }

  return { articleUrl, items };
}
