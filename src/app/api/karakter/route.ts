import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { libraryEntries, titles, titleGenres, genres } from "@/lib/db/schema";
import { getFullProfile } from "@/lib/preference/engine";
import { chat, getAiStatus } from "@/lib/ai/provider";

/* -------------------------------------------------------------------------- */
/* Tahmin oranlari                                                            */
/* -------------------------------------------------------------------------- */

/** Boyut anahtar kelimeleri -> tercih motorundaki boyut anahtari */
const DIMENSION_KEYWORDS: Record<string, string[]> = {
  atmosfer: ["atmosfer", "atmosferik", "mood", "hava"],
  karakter: ["karakter", "kişi", "oyuncu performans", "şahsiyet"],
  tempo: ["tempo", "hız", "aksiyon", "akıcı", "dinamik"],
  gorsel: ["görsel", "estetik", "görüntü", "sinematografi", "güzel"],
  konu: ["konu", "hikaye", "mesaj", "fikir", "anlam", "olay örgüsü"],
};

/** Tur adlarini tercih motorundaki tur agirliklariyla eslestirme anahtarlari */
const GENRE_KEYWORDS: Record<string, string[]> = {
  action: ["aksiyon", "action", "dövüş", "kovalama"],
  drama: ["drama", "dramatik"],
  comedy: ["komedi", "komik", "gülme"],
  crime: ["suç", "crime", "cinayet", "dedektif"],
  mystery: ["gizem", "mystery", "bulmaca"],
  romance: ["romantik", "romance", "aşk", "duygusal"],
  horror: ["korku", "horror", "korkutucu"],
  thriller: ["gerilim", "thriller"],
  "science-fiction": ["bilim kurgu", "sci-fi", "bilimkurgu", "uzay", "gelecek"],
  fantasy: ["fantastik", "fantasy", "büyü", "efsane"],
  adventure: ["macera", "adventure"],
  animation: ["animasyon", "çizgi", "animation"],
  documentary: ["belgesel", "documentary"],
  history: ["tarih", "history"],
  war: ["savaş", "war"],
  music: ["müzik", "music"],
  family: ["aile", "family"],
};

type EnrichedItem = { text: string; oran: number | null };

function normalize(value: string): string {
  return value
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Bir tahmin metnini tercih motorundaki gercek agirliklara baglayip
 * yuzde oranini bulur. Eslesme yoksa null doner (oran uydurulmaz).
 */
function findRatio(
  text: string,
  weights: Record<string, number>
): number | null {
  const normalized = normalize(text);
  if (!normalized) return null;

  let best: number | null = null;
  for (const [key, value] of Object.entries(weights)) {
    const keywords = DIMENSION_KEYWORDS[key] ?? GENRE_KEYWORDS[key] ?? [key];
    const hit = keywords.some(
      (keyword) =>
        normalized.includes(normalize(keyword)) ||
        normalize(keyword).includes(normalized)
    );
    if (hit && (best === null || value > best)) best = value;
  }
  return best === null ? null : Math.round(best * 100);
}

/** AI metinlerini gercek oranlarla zenginlestirir. */
function enrichProfile(profile: any, pref: any) {
  const dims: Record<string, number> = pref?.implicit?.dimensions ?? {};
  const genreWeights: Record<string, number> = pref?.implicit?.genres ?? {};
  const peopleWeights: Record<string, number> = pref?.implicit?.people ?? {};
  const decades: Record<string, number> = pref?.implicit?.decades ?? {};

  const asList = (items: any[]): EnrichedItem[] =>
    (items ?? []).map((item) => {
      const text = typeof item === "string" ? item : String(item ?? "");
      let oran = findRatio(text, dims);
      if (oran === null) oran = findRatio(text, genreWeights);
      if (oran === null) {
        // Insan adlariyla eslesme (or. "Christopher Nolan")
        const people = Object.entries(peopleWeights);
        const hit = people.find(([name]) =>
          normalize(text).includes(normalize(name))
        );
        if (hit) oran = Math.round(hit[1] * 100);
      }
      if (oran === null) {
        const dec = Object.entries(decades).find(([d]) =>
          normalize(text).includes(normalize(d))
        );
        if (dec) oran = Math.round(dec[1] * 100);
      }
      return { text, oran };
    });

  return {
    ...profile,
    gucluYonler: asList(profile.gucluYonler),
    tercihEdilenUnsurlar: asList(profile.tercihEdilenUnsurlar),
    kaaciklanmamisAlanlar: asList(profile.kaaciklanmamisAlanlar),
  };
}

async function getLibraryForAnalysis(userId: string) {
  const db = getDb();
  const watched = await db
    .select({
      originalTitle: titles.originalTitle,
      localizedTitle: titles.localizedTitle,
      releaseYear: titles.releaseYear,
      runtimeMinutes: titles.runtimeMinutes,
      rating: libraryEntries.rating,
      isFavorite: libraryEntries.isFavorite,
      watchedAt: libraryEntries.watchedAt,
      notes: libraryEntries.notes,
      likedAspects: libraryEntries.likedAspects,
      dislikedAspects: libraryEntries.dislikedAspects,
      genreSlug: genres.slug,
      genreNameTr: genres.nameTr,
      overview: titles.overview,
    })
    .from(libraryEntries)
    .innerJoin(titles, eq(libraryEntries.titleId, titles.id))
    .leftJoin(titleGenres, eq(titles.id, titleGenres.titleId))
    .leftJoin(genres, eq(titleGenres.genreId, genres.id))
    .where(and(eq(libraryEntries.userId, userId), eq(libraryEntries.status, "watched")));

  return watched;
}

function buildPrompt(rows: any[]) {
  const films = rows
    .filter((r) => r.rating && r.rating >= 8)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 10)
    .map((r) => `${r.localizedTitle ?? r.originalTitle}`);

  const genreDist: Record<string, number> = {};
  rows.forEach((r) => {
    if (r.genreNameTr) genreDist[r.genreNameTr] = (genreDist[r.genreNameTr] || 0) + 1;
  });
  const topGenres = Object.entries(genreDist).sort((a, b) => b[1] - a[1]).slice(0, 4);

  return `Sen bir sinema analistisin. Verilen filmlerden kişilik profili çıkar.

Kullanıcı verisi:
- En çok izlenen türler: ${topGenres.map(([g, c]) => `${g} (${c})`).join(", ")}
- En yüksek puanlı filmler: ${films.join(", ")}

Görev: SADECE şu JSON formatında cevap ver. Başka hiçbir metin, açıklama veya kod bloğu YAZMA:
{
  "arketip": "Kısa unvan (ör: 'Atmosfer Avcısı')",
  "ozet": "2-3 cümlelik özet",
  "gucluYonler": ["Madde 1", "Madde 2"],
  "tercihEdilenUnsurlar": ["Unsur 1", "Unsur 2"],
  "kaaciklanmamisAlanlar": ["Alan 1", "Alan 2"],
  "oneriler": [{"baslik": "Film Adı", "aciklama": "Neden öneriliyor"}],
  "sinemaMottosu": "Kısa motto"
}`;
}

async function callAi(prompt: string) {
  const result = await chat(
    [
      {
        role: "system",
        content:
          "Sen bir sinema zevk analistisin. Yalnızca istenen JSON'u üret; " +
          "açıklama, selamlama veya kod bloğu yazma.",
      },
      { role: "user", content: prompt },
    ],
    { temperature: 0.2, maxTokens: 400, timeoutMs: 45_000 },
  );
  if (!result.ok) throw new Error(result.message);
  return result.content;
}

function extractJson(text: string): string {
  const mdMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (mdMatch) return mdMatch[1];

  let start = text.indexOf("{");
  let end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    let candidate = text.slice(start, end + 1);
    let depth = 0;
    for (let i = 0; i < candidate.length; i++) {
      if (candidate[i] === "{") depth++;
      else if (candidate[i] === "}") depth--;
      if (depth === 0 && i < candidate.length - 1) {
        candidate = candidate.slice(0, i + 1);
        break;
      }
    }
    return candidate;
  }
  return text;
}

function tryParse(jsonStr: string) {
  try {
    return JSON.parse(jsonStr);
  } catch {
    let fixed = jsonStr
      .replace(/,(\s*[}\]])/g, "$1")
      .replace(/'/g, '"')
      .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
    try {
      return JSON.parse(fixed);
    } catch {
      throw new Error("Parse failed");
    }
  }
}

/* Basit memory cache — aynı kullanıcı için tekrar çağrıyı engeller */
const profileCache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 saat

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cached = profileCache.get(user.id);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  /* Hızlı fallback — anında döner, AI arka planda (opsiyonel) */
  const rows = await getLibraryForAnalysis(user.id);
  if (rows.length === 0) {
    return NextResponse.json({ error: "Kütüphane boş" }, { status: 400 });
  }

  /* Tercih motorundan gercek oranlar (tahmin yuzdeleri bunlardan gelir) */
  const pref = await getFullProfile(user.id);

  /* Veriden basit heuristik profil üret (AI'siz, anında) */
  const genreDist: Record<string, number> = {};
  const titleSet = new Set<string>();
  rows.forEach((r) => {
    if (r.genreNameTr) genreDist[r.genreNameTr] = (genreDist[r.genreNameTr] || 0) + 1;
    titleSet.add(r.originalTitle);
  });
  const topGenres = Object.entries(genreDist).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const watchedCount = titleSet.size;

  /* En yüksek puanlı tekil filmler */
  const filmRatingMap = new Map<string, number>();
  rows.forEach((r) => {
    if (r.rating && r.rating >= 8) {
      const title = r.localizedTitle ?? r.originalTitle;
      const curr = filmRatingMap.get(title) ?? 0;
      if (r.rating > curr) filmRatingMap.set(title, r.rating);
    }
  });
  const topFilms = Array.from(filmRatingMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([title]) => title);

  const fallback = {
    arketip: topGenres[0] ? `${topGenres[0][0]} Severi` : "Sinema Tutkunu",
    ozet: `${watchedCount} film/dizi izlemiş; en çok ${topGenres.slice(0, 2).map(([g]) => g).join(" ve ")} türüne meşgulsün. ${topFilms.length ? `Favoriler: ${topFilms.join(", ")}.` : ""}`,
    gucluYonler: ["Çeşitli türler keşfediyor", "Yüksek puanlı eserler takip ediyor", "Karakter odaklı hikayeler seviyor"],
    tercihEdilenUnsurlar: ["Güçlü senaryo", "Atmosfer", "Oyuncu performansı"],
    kaaciklanmamisAlanlar: ["Klasik sinema (60'lar öncesi)", "Belgesel", "Bağımsız/Arthouse"],
    oneriler: [
      { baslik: "Parasite", aciklama: "Tür karışımı ve sosyal eleştirinin zirvesi" },
      { baslik: "There Will Be Blood", aciklama: "Daniel Day-Lewis'in karakter çalışması ve atmosfer" },
      { baslik: "Stalker", aciklama: "Tarkovski'nin felsefi derinliği ve görsel şiiri" },
    ],
    sinemaMottosu: "Her film bir keşif yolculuğudur.",
  };

  profileCache.set(user.id, {
    data: enrichProfile(fallback, pref),
    ts: Date.now(),
  });

  /* AI'yi arka planda dene (sonuç cache'e yazılır, sonraki istekte gelir) */
  setTimeout(async () => {
    // AI kapalıysa hiçbir sağlayıcıya (yerel dahil) istek gönderme.
    if (!getAiStatus().enabled) return;
    try {
      const prompt = buildPrompt(rows);
      const raw = await callAi(prompt);
      const jsonStr = extractJson(raw);
      const profile = tryParse(jsonStr);
      if (profile && !profile.hata) {
        profileCache.set(user.id, {
          data: enrichProfile(profile, pref),
          ts: Date.now(),
        });
      }
    } catch {
      // Sessizce başarısız ol — fallback zaten var
    }
  }, 0);

  return NextResponse.json(enrichProfile(fallback, pref));
}