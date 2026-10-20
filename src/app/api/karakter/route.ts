import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { libraryEntries, titles, titleGenres, genres } from "@/lib/db/schema";

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
    .slice(0, 12)
    .map((r) => `${r.localizedTitle ?? r.originalTitle} (${r.releaseYear ?? "?"})`);

  const genreDist: Record<string, number> = {};
  rows.forEach((r) => {
    if (r.genreNameTr) genreDist[r.genreNameTr] = (genreDist[r.genreNameTr] || 0) + 1;
  });
  const topGenres = Object.entries(genreDist).sort((a, b) => b[1] - a[1]).slice(0, 4);

  return `Kullanıcı profili (JSON):
Tür: ${topGenres.map(([g, c]) => `${g}(${c})`).join(", ")}
En sevilenler: ${films.join(", ")}

SADECE JSON:
{"arketip":"...","ozet":"...","gucluYonler":["...","..."],"tercihEdilenUnsurlar":["..."],"kaaciklanmamisAlanlar":["..."],"oneriler":[{"baslik":"...","aciklama":"..."}],"sinemaMottosu":"..."}`;
}

async function callOllama(prompt: string) {
  const url = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
  const model = process.env.OLLAMA_MODEL || "llama3.2";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const res = await fetch(`${url}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: { temperature: 0.1, top_p: 0.7, num_predict: 150, num_ctx: 512 },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data = await res.json();
    return data.response?.trim() ?? "";
  } catch (e: any) {
    clearTimeout(timeout);
    if (e.name === "AbortError") throw new Error("Ollama timeout (25sn)");
    throw e;
  }
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

  try {
    const rows = await getLibraryForAnalysis(user.id);
    if (rows.length === 0) {
      return NextResponse.json({ error: "Kütüphane boş" }, { status: 400 });
    }

    const prompt = buildPrompt(rows);
    const raw = await callOllama(prompt);
    const jsonStr = extractJson(raw);
    const profile = tryParse(jsonStr);

    profileCache.set(user.id, { data: profile, ts: Date.now() });
    return NextResponse.json(profile);
  } catch (e: any) {
    /* Fallback profil — AI başarısız olsa da sayfa çalışır */
    const fallback = {
      arketip: "Sinema Tutkunu",
      ozet: "AI profili şu an oluşturulamadı. Daha sonra tekrar deneyin.",
      gucluYonler: ["Çeşitli türler", "Yüksek puanlı filmler"],
      tercihEdilenUnsurlar: ["Güçlü hikaye", "Karakter derinliği"],
      kaaciklanmamisAlanlar: ["Eski sinema", "Belgesel"],
      oneriler: [
        { baslik: "Parasite", aciklama: "Tür karışımı ve sosyal eleştiri" },
        { baslik: "There Will Be Blood", aciklama: "Karakter çalışması ve atmosfer" },
        { baslik: "Stalker", aciklama: "Felsefi derinlik ve görsel şiir" },
      ],
      sinemaMottosu: "Her film bir keşif yolculuğudur.",
    };
    return NextResponse.json(fallback);
  }
}