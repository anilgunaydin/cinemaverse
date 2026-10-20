import type { Metadata } from "next";
import Link from "next/link";

import { AppHeader } from "@/components/layout/app-header";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listPublicReviews } from "@/lib/community/reviews";

export const metadata: Metadata = { title: "Topluluk" };

export default async function CommunityPage() {
  const user = await getCurrentUser();
  const reviews = await listPublicReviews(40);

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <p className="text-[0.68rem] uppercase tracking-[0.22em] text-gold-400">
          Topluluk
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">
          Herkese açık incelemeler
        </h1>
        <p className="muted mt-1">
          CinemaVerse kullanıcılarının paylaştığı incelemeler. Yalnızca
          &ldquo;herkese açık&rdquo; işaretli, gerçek kullanıcı incelemeleri
          listelenir.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/discussions" className="chip hover:text-mist-100">
            💬 Tartışmalar
          </Link>
          <Link href="/lists" className="chip hover:text-mist-100">
            🗂️ Kullanıcı listeleri
          </Link>
        </div>

        {reviews.length === 0 ? (
          <div className="surface mt-6 px-5 py-12 text-center">
            <h2 className="font-display text-lg font-semibold">
              Henüz paylaşılan inceleme yok
            </h2>
            <p className="muted mx-auto mt-1 max-w-md">
              Bir yapımın sayfasından inceleme yazdığınızda, görünürlüğünü
              &ldquo;herkese açık&rdquo; seçerseniz burada listelenir.
            </p>
            <Link href="/search" className="btn btn-primary mt-4">
              Yapım bul ve incele
            </Link>
          </div>
        ) : (
          <ul className="mt-6 flex flex-col gap-3">
            {reviews.map((review) => (
              <li key={review.id} className="surface p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-mist-500">
                  <span className="font-medium text-mist-200">
                    {review.authorName}
                  </span>
                  <span aria-hidden="true">·</span>
                  <Link
                    href={`/title/${review.titleId}`}
                    className="text-gold-400 hover:underline"
                  >
                    {review.titleName}
                    {review.releaseYear ? ` (${review.releaseYear})` : ""}
                  </Link>
                  {review.rating ? (
                    <span className="chip chip-gold">{review.rating}/10</span>
                  ) : null}
                  <span>{new Date(review.createdAt).toLocaleDateString("tr-TR")}</span>
                </div>

                {review.containsSpoiler ? (
                  <p className="mt-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-xs text-rose-400">
                    Bu inceleme spoiler içeriyor
                    {review.spoilerScopeSeason
                      ? ` (${review.spoilerScopeSeason}. sezona kadar)`
                      : ""}
                    . İçeriği yapım sayfasında, izleme durumunuza göre
                    görebilirsiniz.
                  </p>
                ) : (
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-mist-300">
                    {review.body}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        {!user ? (
          <p className="muted mt-6">
            İnceleme yazmak için{" "}
            <Link href="/login" className="text-gold-400 hover:underline">
              giriş yapın
            </Link>
            .
          </p>
        ) : null}
      </main>
    </>
  );
}
