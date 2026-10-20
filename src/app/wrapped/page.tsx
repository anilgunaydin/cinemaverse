import { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { libraryEntries, titles, titleGenres, genres } from "@/lib/db/schema";
import { notFound } from "next/navigation";
import Link from "next/link";

const GENRE_LABELS: Record<string, string> = {
  action: "Aksiyon",
  adventure: "Macera",
  comedy: "Komedi",
  crime: "Suç",
  drama: "Dram",
  fantasy: "Fantastik",
  horror: "Korku",
  mystery: "Gizem",
  romance: "Romantik",
  "science-fiction": "Bilim Kurgu",
  thriller: "Gerilim",
  war: "Savaş",
  western: "Western",
  animation: "Animasyon",
  documentary: "Belgesel",
  family: "Aile",
  music: "Müzik",
  history: "Tarih",
  biography: "Biyografi",
  "action-thriller": "Aksiyon Gerilim",
  "comedy-drama": "Komedi Dram",
  "crime-drama": "Suç Dram",
  "crime-thriller": "Suç Gerilim",
  "psychological-thriller": "Psikolojik Gerilim",
  "psychological-drama": "Psikolojik Dram",
  "historical-drama": "Tarih Dram",
  dystopian: "Distopik",
  cyberpunk: "Siberpunk",
  superhero: "Süper Kahraman",
  "post-apocalyptic": "Post-Apokaliptik",
  "time-travel": "Zaman Yolculuğu",
  "coming-of-age": "Olgunlaşma",
  "neo-noir": "Yeni Noir",
  "film-noir": "Film Noir",
  detective: "Dedektif",
  police: "Polisiye",
  heist: "Soygun",
  sport: "Spor",
  martial: "Martial Arts",
  musical: "Müzikal",
};

function genreTr(slug: string) {
  return GENRE_LABELS[slug] ?? slug;
}

function formatHours(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h} sa ${m} dk` : `${m} dk`;
}

async function getWrappedData(userId: string) {
  const db = getDb();

  const watched = await db
    .select({
      titleId: libraryEntries.titleId,
      rating: libraryEntries.rating,
      watchedAt: libraryEntries.watchedAt,
      watchedPeriod: libraryEntries.watchedPeriod,
      isFavorite: libraryEntries.isFavorite,
      kind: titles.kind,
      originalTitle: titles.originalTitle,
      localizedTitle: titles.localizedTitle,
      releaseYear: titles.releaseYear,
      runtimeMinutes: titles.runtimeMinutes,
      posterUrl: titles.posterUrl,
      backdropUrl: titles.backdropUrl,
      externalRating: titles.externalRating,
      externalRatingCount: titles.externalRatingCount,
    })
    .from(libraryEntries)
    .innerJoin(titles, eq(libraryEntries.titleId, titles.id))
    .where(and(eq(libraryEntries.userId, userId), eq(libraryEntries.status, "watched")));

  if (watched.length === 0) return null;

  /* Tür dağılımı */
  const genreRows = await db
    .select({ slug: genres.slug, nameTr: genres.nameTr, cnt: titles.id })
    .from(libraryEntries)
    .innerJoin(titles, eq(libraryEntries.titleId, titles.id))
    .innerJoin(titleGenres, eq(titles.id, titleGenres.titleId))
    .innerJoin(genres, eq(titleGenres.genreId, genres.id))
    .where(and(eq(libraryEntries.userId, userId), eq(libraryEntries.status, "watched")))
    .groupBy(genres.slug, genres.nameTr);

  const genreCounts: Record<string, number> = {};
  genreRows.forEach((r) => {
    genreCounts[r.slug] = (genreCounts[r.slug] || 0) + 1;
  });

  /* Yıl dağılımı (izleme yılına göre - watchedAt yoksa releaseYear) */
  const yearCounts: Record<number, number> = {};
  let totalMinutes = 0;
  let topRated = { title: "", rating: 0 };
  let favCount = 0;

  watched.forEach((w) => {
    const yr = w.watchedAt
      ? new Date(w.watchedAt).getFullYear()
      : w.releaseYear ?? 0;
    if (yr) yearCounts[yr] = (yearCounts[yr] || 0) + 1;
    if (w.runtimeMinutes) totalMinutes += w.runtimeMinutes;
    if (w.rating && w.rating > topRated.rating) {
      topRated = { title: w.localizedTitle ?? w.originalTitle ?? "", rating: w.rating };
    }
    if (w.isFavorite) favCount += 1;
  });

  /* En çok izlenen dekad (yapım yılına göre) */
  const decadeCounts: Record<string, number> = {};
  watched.forEach((w) => {
    if (w.releaseYear) {
      const dec = `${Math.floor(w.releaseYear / 10) * 10}'ler`;
      decadeCounts[dec] = (decadeCounts[dec] || 0) + 1;
    }
  });

  /* En yüksek harici puanli */
  const highestExternal = watched
    .filter((w) => w.externalRating != null)
    .sort((a, b) => (b.externalRating ?? 0) - (a.externalRating ?? 0))[0];

  return {
    totalWatched: watched.length,
    totalHours: Math.round(totalMinutes / 60),
    totalMinutes,
    genreCounts: Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8),
    yearCounts: Object.entries(yearCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10),
    decadeCounts: Object.entries(decadeCounts).sort((a, b) => b[1] - a[1]),
    topRated,
    favCount,
    highestExternal,
    recentWatched: watched
      .filter((w) => w.watchedAt)
      .sort((a, b) => new Date(b.watchedAt!).getTime() - new Date(a.watchedAt!).getTime())
      .slice(0, 6),
  };
}

export default async function WrappedPage() {
  const user = await getCurrentUser();
  if (!user) notFound();

  const data = await getWrappedData(user.id);
  if (!data) {
    return (
      <div className="mx-auto max-w-3xl py-16 px-4 text-center">
        <h1 className="font-display text-3xl font-bold text-mist-100 mb-4">Sinema Wrapped</h1>
        <p className="text-mist-400">Henüz izlediğin bir yapım yok. Kütüphaneye ekleyip "İzledim" deyin.</p>
      </div>
    );
  }

  const currentYear = new Date().getFullYear();

  return (
    <main className="mx-auto max-w-4xl py-10 px-4">
      <header className="mb-10 text-center">
        <h1 className="font-display text-4xl font-bold text-mist-100 mb-2">
          Sinema Wrapped {currentYear}
        </h1>
        <p className="text-mist-400">
          {data.totalWatched} yapım, {data.totalHours} saat sinema — senin yılın özeti.
        </p>
      </header>

      {/* Özet kartları */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-10">
        <StatCard icon="🎬" value={data.totalWatched} label="İzlenen" />
        <StatCard icon="⏱️" value={data.totalHours} label="Saat" suffix="sa" />
        <StatCard icon="⭐" value={data.topRated.rating || "—"} label="En Yüksek Puanım" />
        <StatCard icon="❤️" value={data.favCount} label="Favori" />
      </section>

      {/* Tür dağılımı */}
      <section className="mb-10">
        <h2 className="font-display text-xl font-semibold text-mist-100 mb-4">Tür Haritası</h2>
        <div className="flex flex-wrap gap-2">
          {data.genreCounts.map(([slug, count]) => (
            <span
              key={slug}
              className="rounded-full border border-ink-600 bg-ink-800 px-3 py-1 text-sm text-mist-200"
            >
              {genreTr(slug)} <span className="text-gold-300 font-semibold">{count}</span>
            </span>
          ))}
        </div>
      </section>

      {/* Dekad dağılımı */}
      <section className="mb-10">
        <h2 className="font-display text-xl font-semibold text-mist-100 mb-4">Zaman Tüneli (Yapım Dekadları)</h2>
        <div className="space-y-2">
          {data.decadeCounts.map(([dec, count]) => (
            <DecadeBar key={dec} label={dec} count={count} max={data.totalWatched} />
          ))}
        </div>
      </section>

      {/* Yıl dağılımı (izleme yılına göre) */}
      <section className="mb-10">
        <h2 className="font-display text-xl font-semibold text-mist-100 mb-4">İzleme Yılları</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.yearCounts.map(([yr, count]) => (
            <YearCard key={yr} year={Number(yr)} count={count} />
          ))}
        </div>
      </section>

      {/* Son izlenenler */}
      <section className="mb-10">
        <h2 className="font-display text-xl font-semibold text-mist-100 mb-4">Son İzlediklerin</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.recentWatched.map((w) => (
            <RecentCard key={w.titleId} item={w} />
          ))}
        </div>
      </section>

      {/* Öne çıkanlar */}
      <section>
        <h2 className="font-display text-xl font-semibold text-mist-100 mb-4">Öne Çıkanlar</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {data.topRated.title && (
            <HighlightCard
              icon="🏆"
              title="En Yüksek Puanım"
              subtitle={data.topRated.title}
              detail={`${data.topRated.rating}/10`}
            />
          )}
          {data.highestExternal && (
            <HighlightCard
              icon="🌍"
              title="En Yüksek Dünya Puanı"
              subtitle={data.highestExternal.localizedTitle ?? data.highestExternal.originalTitle}
              detail={`${data.highestExternal.externalRating}/10 (${data.highestExternal.externalRatingCount ?? "?"} oyla)`}
            />
          )}
        </div>
      </section>
    </main>
  );
}

function StatCard({ icon, value, label, suffix = "" }: { icon: string; value: number | string; label: string; suffix?: string }) {
  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-850/80 p-5 text-center">
      <span className="text-3xl">{icon}</span>
      <div className="mt-2 font-display text-3xl font-bold text-mist-100">
        {value}{suffix}
      </div>
      <div className="text-sm text-mist-500">{label}</div>
    </div>
  );
}

function DecadeBar({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = Math.round((count / max) * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 text-right text-sm text-mist-400 font-mono">{label}</span>
      <div className="flex-1 h-3 bg-ink-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-gold-500 to-gold-400 rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-12 text-sm text-mist-400 font-mono">{count}</span>
    </div>
  );
}

function YearCard({ year, count }: { year: number; count: number }) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-850/80 p-4 text-center">
      <div className="font-display text-2xl font-bold text-gold-300">{year}</div>
      <div className="text-mist-300">{count} yapım</div>
    </div>
  );
}

function RecentCard({ item }: { item: any }) {
  const date = item.watchedAt ? new Date(item.watchedAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }) : "Tarih yok";
  return (
    <Link href={`/title/${item.titleId}`} className="group flex gap-3 rounded-xl border border-ink-700 bg-ink-850/80 p-3 transition-colors hover:border-gold-500/40">
      {(item.backdropUrl ?? item.posterUrl) && (
        <img
          src={item.backdropUrl ?? item.posterUrl}
          alt=""
          className="h-24 w-43 object-cover rounded-lg flex-shrink-0"
          loading="lazy"
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-mist-100 line-clamp-1 group-hover:text-gold-300 transition-colors">
          {item.localizedTitle ?? item.originalTitle}
        </p>
        <p className="text-xs text-mist-500">{date}</p>
        {item.rating && <span className="inline-block mt-1 text-xs bg-gold-500/20 text-gold-300 px-1.5 py-0.5 rounded">⭐ {item.rating}</span>}
      </div>
    </Link>
  );
}

function HighlightCard({ icon, title, subtitle, detail }: { icon: string; title: string; subtitle: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-850/80 p-5">
      <div className="flex items-start gap-3">
        <span className="text-3xl">{icon}</span>
        <div>
          <p className="text-sm text-mist-500">{title}</p>
          <p className="font-medium text-mist-100">{subtitle}</p>
          <p className="text-sm text-gold-300 mt-1">{detail}</p>
        </div>
      </div>
    </div>
  );
}