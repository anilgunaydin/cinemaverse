import type { Metadata } from "next";
import Link from "next/link";

import { AppHeader } from "@/components/layout/app-header";
import { GenreRow } from "@/components/catalog/genre-row";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listGenres, listTitlesWithGenres } from "@/lib/catalog/service";
import { groupByGenre } from "@/lib/catalog/genre-groups";
import { normalizeTitle } from "@/lib/catalog/matching";

export const metadata: Metadata = { title: "Keşfet" };

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string; q?: string; kind?: string }>;
}) {
  const user = await getCurrentUser();
  const { q, kind: kindParam } = await searchParams;
  const kind =
    kindParam === "movie" || kindParam === "series" ? kindParam : undefined;

  const [catalogTitles, genres] = await Promise.all([
    listTitlesWithGenres(400),
    listGenres(),
  ]);

  const needle = q ? normalizeTitle(q) : "";
  const searchFiltered = needle
    ? catalogTitles.filter(
        (item) =>
          normalizeTitle(item.originalTitle).includes(needle) ||
          normalizeTitle(item.localizedTitle ?? "").includes(needle),
      )
    : catalogTitles;

  const movieCount = searchFiltered.filter(
    (item) => item.kind === "movie",
  ).length;
  const seriesCount = searchFiltered.filter(
    (item) => item.kind === "series",
  ).length;

  const filtered = kind
    ? searchFiltered.filter((item) => item.kind === kind)
    : searchFiltered;

  // Arama sonucunda tek bir yapım bile görünsün: eşiği düşür. Normal
  // keşfette tek tük türler sayfayı yüzlerce satıra çevirmesin.
  const genreGroups = groupByGenre(filtered, { minItems: needle ? 1 : 5 });
  const slugByName = new Map(genres.map((entry) => [entry.nameTr, entry.slug]));

  const kindHref = (value?: "movie" | "series") => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (value) params.set("kind", value);
    const query = params.toString();
    return query ? `/?${query}` : "/";
  };

  const kindFilters: {
    value?: "movie" | "series";
    label: string;
    count: number;
  }[] = [
    { label: "Tümü", count: searchFiltered.length },
    { value: "movie", label: "Filmler", count: movieCount },
    { value: "series", label: "Diziler", count: seriesCount },
  ];

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <section className="surface relative overflow-hidden px-5 py-8 sm:px-8 sm:py-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-gold-500/10 blur-3xl"
          />
          <p className="text-[0.68rem] uppercase tracking-[0.24em] text-gold-400">
            CinemaVerse
          </p>
          <h1 className="mt-2 max-w-2xl font-display text-3xl font-semibold leading-tight sm:text-4xl">
            İzlediklerinizi hatırlayan, zevkinizi öğrenen sinema hafızanız
          </h1>
          <p className="muted mt-3 max-w-xl">
            Filmleri ve dizileri kaydedin, puanlayın, notlar alın. Öneriler
            yalnızca sizin verilerinize dayanır ve neden önerildiğini açıklar.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/search" className="btn btn-primary">
              Film veya dizi ara
            </Link>
            <Link
              href={user ? "/library" : "/register"}
              className="btn btn-ghost"
            >
              {user ? "Kütüphaneme git" : "Ücretsiz hesap oluştur"}
            </Link>
            <Link href="/franchises" className="btn btn-ghost">
              Film evrenleri (Franchise&rsquo;ler)
            </Link>
          </div>
        </section>

        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold">
                Türlere göre keşfet
              </h2>
              <p className="muted mt-0.5">
                {searchFiltered.length > 0
                  ? kind
                    ? `${filtered.length} ${
                        kind === "movie" ? "film" : "dizi"
                      } · ${genreGroups.length} tür satırında, her yapım bir kez.`
                    : `${searchFiltered.length} yapım · ${movieCount} film · ${seriesCount} dizi — her yapım tek bir tür satırında.`
                  : q
                    ? "Aramanızla eşleşen yapım yok."
                    : "Katalogda henüz yapım yok."}
              </p>
            </div>
            <div
              role="group"
              aria-label="Yapım türü"
              className="inline-flex rounded-xl border border-ink-700 bg-ink-900/80 p-0.5"
            >
              {kindFilters.map((filter) => {
                const active = kind === filter.value;
                return (
                  <Link
                    key={filter.label}
                    href={kindHref(filter.value)}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? "bg-gold-500/15 text-gold-300"
                        : "text-mist-400 hover:text-mist-100"
                    }`}
                  >
                    {filter.label}
                    <span className="text-[0.65rem] text-mist-500">
                      {filter.count}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          {genreGroups.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {genreGroups
                .filter((group) => slugByName.has(group.name))
                .map((group) => (
                  <a
                    key={group.name}
                    href={`#tur-${slugByName.get(group.name)}`}
                    className="chip transition-colors hover:border-gold-500/40 hover:text-gold-300"
                  >
                    {group.name}
                    <span className="ml-1 text-[0.62rem] text-mist-500">
                      {group.items.length}
                    </span>
                  </a>
                ))}
            </div>
          ) : null}

          {filtered.length === 0 ? (
            <div className="surface-flat mt-4 px-5 py-10 text-center">
              <p className="font-medium text-mist-200">
                {q
                  ? "Aramanızla eşleşen yapım yok"
                  : kind
                    ? "Bu filtrede yapım yok"
                    : "Katalogda henüz yapım yok"}
              </p>
              <p className="muted mx-auto mt-1 max-w-md">
                {q
                  ? "Farklı bir kelime deneyin veya aramayı temizleyin."
                  : kind
                    ? "Tüm yapımlara dönüp farklı bir tür seçebilirsiniz."
                    : "Arama sayfasından bir film veya dizi ekleyerek başlayın. Eklenen yapımlar gerçek kaynaklardan (Wikidata, TVmaze) alınır."}
              </p>
              <Link
                href={q || kind ? "/" : "/search"}
                className="btn btn-primary mt-4"
              >
                {q
                  ? "Aramayı temizle"
                  : kind
                    ? "Tüm yapımları göster"
                    : "Aramaya başla"}
              </Link>
            </div>
          ) : (
            <div className="mt-3">
              {genreGroups.map((group) => (
                <GenreRow
                  key={group.name}
                  name={group.name}
                  slug={slugByName.get(group.name) ?? null}
                  items={group.items.map((item) => ({
                    id: item.id,
                    title: item.localizedTitle ?? item.originalTitle,
                    subtitle: item.releaseYear?.toString() ?? null,
                    posterUrl: item.posterUrl,
                    backdropUrl: item.backdropUrl,
                    trailerUrl: item.trailerUrl,
                    rating: item.externalRating,
                    kind: item.kind === "series" ? "series" : "movie",
                  }))}
                />
              ))}
            </div>
          )}
        </section>

        <section className="mt-10 grid gap-3 sm:grid-cols-3">
          {[
            {
              title: "Kişisel hafıza",
              body: "İzleme durumu, puan, not ve hatırladığınız sahneler tek yerde. Puan vermezseniz sistem sizin adınıza puan üretmez.",
            },
            {
              title: "Açıklanabilir öneriler",
              body: "Öneriler yalnızca sizin verilerinize dayanır; her önerinin gerekçesi ve belirsizlik düzeyi gösterilir.",
            },
            {
              title: "Kaynaklı araştırma",
              body: "İnternetteki eleştiriler kaynak ve erişim tarihiyle listelenir. Kaynak yoksa bunu açıkça söyler.",
            },
          ].map((card) => (
            <div key={card.title} className="surface-flat p-4">
              <h3 className="text-sm font-semibold text-mist-100">
                {card.title}
              </h3>
              <p className="muted mt-1">{card.body}</p>
            </div>
          ))}
        </section>
      </main>
    </>
  );
}
