import { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { libraryEntries, titles, titleGenres, genres } from "@/lib/db/schema";
import { notFound } from "next/navigation";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Sinema Karakterin — CinemaVerse",
  description: "Kütüphanenden yola çıkarak AI'nın çizdiği sinema kişiliğin.",
};

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
  const films = rows.map((r) => ({
    title: r.localizedTitle ?? r.originalTitle,
    year: r.releaseYear,
    genre: r.genreNameTr,
    rating: r.rating,
    favorite: r.isFavorite,
    notes: r.notes,
    liked: r.likedAspects,
    disliked: r.dislikedAspects,
  }));

  const genreDist: Record<string, number> = {};
  rows.forEach((r) => {
    if (r.genreNameTr) genreDist[r.genreNameTr] = (genreDist[r.genreNameTr] || 0) + 1;
  });

  const topGenres = Object.entries(genreDist).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return `Aşağıda bir kullanıcının izlediği 63 film/dizi listesi ve tür dağılımı var. Bu veriden yola çıkarak kullanıcının **sinema kişiliğini** Türkçe, samimi ama analitik bir dille tanımlayacak bir profil yaz.

**Tür Dağılımı (en çok 5):**
${topGenres.map(([g, c]) => `- ${g}: ${c}`).join("\n")}

**İzlenenler (bazı notlarıyla):**
${films
  .slice(0, 30)
  .map(
    (f) =>
      `- ${f.title} (${f.year ?? "?"}) [${f.genre ?? "?"}]${f.rating ? ` ⭐${f.rating}` : ""}${f.favorite ? " ❤️" : ""}${f.notes ? ` — "${f.notes.slice(0, 80)}"` : ""}${f.liked ? ` 👍${f.liked.slice(0, 60)}` : ""}`
  )
  .join("\n")}

**Çıktı formatı (JSON, sadece JSON):**
{
  "arketip": "Kısa,击中 kelime: örn. 'Atmosfer Avcısı', 'Nostalji Koleksiyoneri', 'Karakter Çalışması Tutkunu'",
  "ozet": "2-3 cümlelik kişilik özeti",
  "gucluYonler": ["Madde 1", "Madde 2", "Madde 3"],
  "tercihEdilenUnsurlar": ["Atmosfer", "Karakter derinliği", "Görsel anlatım"],
  "kaaciklanmamisAlanlar": ["Bilim kurgu eksik", "Eski sinema (60'lar öncesi) az"],
  "oneriler": [
    {"baslik": "Öneri 1", "aciklama": "Neden..."},
    {"baslik": "Öneri 2", "aciklama": "Neden..."},
    {"baslik": "Öneri 3", "aciklama": "Neden..."}
  ],
  "sinemaMottosu": "Kısa, etkili bir motto"
}`;
}

async function callOllama(prompt: string) {
  const url = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
  const model = process.env.OLLAMA_MODEL || "llama3.2";

  const res = await fetch(`${url}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: { temperature: 0.7, top_p: 0.9 },
    }),
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
  const data = await res.json();
  return data.response?.trim() ?? "";
}

async function getProfile(userId: string) {
  const rows = await getLibraryForAnalysis(userId);
  if (rows.length === 0) return null;

  const prompt = buildPrompt(rows);
  const raw = await callOllama(prompt);

  /* JSON ayıkla (model bazen markdown code block döndürür) */
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch ? jsonMatch[0] : raw;

  try {
    return JSON.parse(jsonStr);
  } catch {
    return { hata: "AI yanıtı işlenemedi", ham: raw.slice(0, 500) };
  }
}

export default async function KarakterPage() {
  const user = await getCurrentUser();
  if (!user) notFound();

  return (
    <main className="mx-auto max-w-3xl py-10 px-4">
      <header className="mb-10 text-center">
        <h1 className="font-display text-4xl font-bold text-mist-100 mb-2">Sinema Karakterin</h1>
        <p className="text-mist-400">Kütüphanenden yola çıkarak AI'nın çizdiği profilin.</p>
      </header>
      <Suspense fallback={<ProfileSkeleton />}>
        <ProfileContent userId={user.id} />
      </Suspense>
    </main>
  );
}

async function ProfileContent({ userId }: { userId: string }) {
  const profile = await getProfile(userId);

  if (!profile || profile.hata) {
    return (
      <div className="rounded-2xl border border-ink-700 bg-ink-850/80 p-8 text-center">
        <p className="text-mist-400 mb-2">Profil oluşturulamadı.</p>
        {profile?.ham && <pre className="text-xs text-mist-500 overflow-auto max-h-60 p-4 bg-ink-900 rounded">{profile.ham}</pre>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Arketip + Motto */}
      <div className="rounded-2xl border border-gold-500/30 bg-gradient-to-br from-gold-500/10 to-ink-900 p-6 text-center">
        <p className="text-sm text-gold-300 uppercase tracking-wide mb-1">Sinema Arketipin</p>
        <h2 className="font-display text-3xl font-bold text-mist-100 mb-3">{profile.arketip ?? "—"}</h2>
        <p className="text-lg text-mist-300 italic">"{profile.sinemaMottosu ?? "Sinema bir zaman makinesidir."}"</p>
      </div>

      {/* Özet */}
      <section className="rounded-2xl border border-ink-700 bg-ink-850/80 p-5">
        <h3 className="font-semibold text-mist-100 mb-2 flex items-center gap-2">
          <span className="text-gold-300">📝</span> Kişilik Özeti
        </h3>
        <p className="text-mist-300 leading-relaxed">{profile.ozet ?? "—"}</p>
      </section>

      /* Güçlü yönler & Tercih edilen unsurlari */
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-2xl border border-ink-700 bg-ink-850/80 p-5">
          <h3 className="font-semibold text-mist-100 mb-3 flex items-center gap-2">
            <span className="text-gold-300">💪</span> Güçlü Yönlerin
          </h3>
          <ul className="space-y-2">
            {(profile.gucluYonler ?? []).map((item: string, i: number) => (
              <li key={i} className="flex items-center gap-2 text-mist-300">
                <span className="text-gold-300">→</span> {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-ink-700 bg-ink-850/80 p-5">
          <h3 className="font-semibold text-mist-100 mb-3 flex items-center gap-2">
            <span className="text-gold-300">🎯</span> Tercih Edilen Unsurlar
          </h3>
          <ul className="space-y-2">
            {(profile.tercihEdilenUnsurlar ?? []).map((item: string, i: number) => (
              <li key={i} className="flex items-center gap-2 text-mist-300">
                <span className="text-gold-300">→</span> {item}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Kaçırılan alanlar */}
      <section className="rounded-2xl border border-ink-700 bg-ink-850/80 p-5">
        <h3 className="font-semibold text-mist-100 mb-3 flex items-center gap-2">
          <span className="text-gold-300">🕳️</span> Keşfedilmemiş Alanlar
        </h3>
        <ul className="space-y-2">
          {(profile.kaaciklanmamisAlanlar ?? []).map((item: string, i: number) => (
            <li key={i} className="flex items-center gap-2 text-mist-400">
              <span className="text-gold-500/70">○</span> {item}
            </li>
          ))}
        </ul>
      </section>

      {/* AI Önerileri */}
      <section className="rounded-2xl border border-ink-700 bg-ink-850/80 p-5">
        <h3 className="font-semibold text-mist-100 mb-4 flex items-center gap-2">
          <span className="text-gold-300">🤖</span> Sana Özel Öneriler
        </h3>
        <div className="space-y-3">
          {(profile.oneriler ?? []).map((rec: any, i: number) => (
            <div key={i} className="rounded-xl border border-ink-600 bg-ink-900/60 p-4">
              <p className="font-medium text-mist-100">{rec.baslik}</p>
              <p className="text-sm text-mist-400 mt-1">{rec.aciklama}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-ink-700 bg-ink-850/80 p-6">
        <div className="h-8 w-48 bg-ink-700 animate-pulse rounded mx-auto mb-3" />
        <div className="h-4 w-64 bg-ink-700 animate-pulse rounded mx-auto" />
      </div>
      <div className="rounded-2xl border border-ink-700 bg-ink-850/80 p-5">
        <div className="h-4 w-32 bg-ink-700 animate-pulse rounded mb-3" />
        <div className="h-4 w-full bg-ink-700 animate-pulse rounded" />
        <div className="h-4 w-3/4 bg-ink-700 animate-pulse rounded mt-2" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-ink-700 bg-ink-850/80 p-5">
          <div className="h-4 w-24 bg-ink-700 animate-pulse rounded mb-3" />
          <div className="space-y-2"><div className="h-4 w-full bg-ink-700 animate-pulse rounded" /><div className="h-4 w-full bg-ink-700 animate-pulse rounded" /></div>
        </div>
        <div className="rounded-2xl border border-ink-700 bg-ink-850/80 p-5">
          <div className="h-4 w-24 bg-ink-700 animate-pulse rounded mb-3" />
          <div className="space-y-2"><div className="h-4 w-full bg-ink-700 animate-pulse rounded" /><div className="h-4 w-full bg-ink-700 animate-pulse rounded" /></div>
        </div>
      </div>
    </div>
  );
}