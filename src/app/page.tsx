import type { Metadata } from "next";
import Link from "next/link";

import { AppHeader } from "@/components/layout/app-header";
import { PosterCard } from "@/components/catalog/poster-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listGenres, listTitles } from "@/lib/catalog/service";

export const metadata: Metadata = { title: "Keşfet" };

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string; q?: string }>;
}) {
  const user = await getCurrentUser();
  const { genre, q } = await searchParams;

  const [{ items, total }, genres] = await Promise.all([
    listTitles({ limit: 24, sort: "recent", query: q }),
    listGenres(),
  ]);

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
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-display text-xl font-semibold">
                Kütüphanenizdeki yapımlar
              </h2>
              <p className="muted mt-0.5">
                {total > 0
                  ? `${total} yapım kayıtlı.`
                  : "Henüz yapım eklemediniz."}
              </p>
            </div>
            {genres.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {genres.slice(0, 8).map((g) => (
                  <Link
                    key={g.id}
                    href={`/?genre=${g.slug}`}
                    className={`chip ${
                      genre === g.slug ? "chip-gold" : ""
                    }`}
                  >
                    {g.nameTr}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          {items.length === 0 ? (
            <div className="surface-flat mt-4 px-5 py-10 text-center">
              <p className="font-medium text-mist-200">
                Katalogda henüz yapım yok
              </p>
              <p className="muted mx-auto mt-1 max-w-md">
                Arama sayfasından bir film veya dizi ekleyerek başlayın. Eklenen
                yapımlar gerçek kaynaklardan (Wikidata, TVmaze) alınır.
              </p>
              <Link href="/search" className="btn btn-primary mt-4">
                Aramaya başla
              </Link>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {items.map((item) => (
                <PosterCard
                  key={item.id}
                  href={`/title/${item.id}`}
                  title={item.localizedTitle ?? item.originalTitle}
                  subtitle={[
                    item.releaseYear?.toString(),
                    item.kind === "series" ? "Dizi" : "Film",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  posterUrl={item.posterUrl}
                  backdropUrl={item.backdropUrl}
                  trailerUrl={item.trailerUrl}
                  rating={item.externalRating}
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
