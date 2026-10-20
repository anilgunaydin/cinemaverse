import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/layout/app-header";
import { PosterCard } from "@/components/catalog/poster-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getLibraryStats, listLibrary } from "@/lib/library/service";
import { WATCH_STATUS_LABELS } from "@/lib/library/labels";
import type { WatchStatus } from "@/lib/db/schema";

export const metadata: Metadata = { title: "Kütüphanem" };

const FILTERS: { value: WatchStatus | "all"; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "watched", label: "İzledim" },
  { value: "watching", label: "İzliyorum" },
  { value: "watchlist", label: "İzleme listem" },
  { value: "dropped", label: "Yarım bıraktım" },
  { value: "not_watched", label: "İzlemedim" },
  { value: "unsure", label: "Emin değilim" },
];

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { status: statusParam } = await searchParams;
  const status =
    statusParam && statusParam in WATCH_STATUS_LABELS
      ? (statusParam as WatchStatus)
      : undefined;

  const [library, stats] = await Promise.all([
    listLibrary(user.id, { status, limit: 200 }),
    getLibraryStats(user.id),
  ]);

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[0.68rem] uppercase tracking-[0.22em] text-gold-400">
              Kişisel hafıza
            </p>
            <h1 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">
              Kütüphanem
            </h1>
            <p className="muted mt-1">
              {stats.total} kayıt · {stats.ratedCount} puanlanmış yapım
              {stats.averageRating !== null
                ? ` · ortalama puan ${stats.averageRating.toFixed(1)}/10`
                : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/search" className="btn btn-primary">
              Yapım ekle
            </Link>
            <Link href="/settings/data" className="btn btn-ghost">
              İçe / dışa aktar
            </Link>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-1.5">
          {FILTERS.map((filter) => {
            const count =
              filter.value === "all"
                ? stats.total
                : stats.byStatus[filter.value as WatchStatus];
            const active = (statusParam ?? "all") === filter.value;
            const href =
              filter.value === "all" ? "/library" : `/library?status=${filter.value}`;
            return (
              <Link
                key={filter.value}
                href={href}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "border-gold-500/50 bg-gold-500/15 text-gold-300"
                    : "border-ink-600 bg-ink-900 text-mist-400 hover:text-mist-200"
                }`}
              >
                {filter.label}
                <span className="ml-1.5 text-[0.65rem] text-mist-500">{count}</span>
              </Link>
            );
          })}
        </div>

        {library.items.length === 0 ? (
          <div className="surface mt-6 px-5 py-12 text-center">
            <h2 className="font-display text-lg font-semibold">
              {status ? "Bu durumda kayıt yok" : "Kütüphaneniz henüz boş"}
            </h2>
            <p className="muted mx-auto mt-1 max-w-md">
              {status
                ? "Farklı bir izleme durumu seçin veya yeni bir yapım ekleyin."
                : "Arama yaparak bir film veya dizi ekleyin. Eklediğiniz yapımların detaylarını, puanlarınızı ve notlarınızı burada bulacaksınız."}
            </p>
            <Link href="/search" className="btn btn-primary mt-4">
              Film veya dizi ara
            </Link>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {library.items.map((item) => (
              <div key={item.entryId} className="relative">
                <PosterCard
                  href={`/title/${item.titleId}`}
                  title={item.localizedTitle ?? item.originalTitle}
                  subtitle={[
                    item.releaseYear?.toString(),
                    WATCH_STATUS_LABELS[item.status],
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  posterUrl={item.posterUrl}
                  backdropUrl={item.backdropUrl}
                  trailerUrl={item.trailerUrl}
                  rating={item.rating}
                  badge={item.isFavorite ? "★" : null}
                />
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
