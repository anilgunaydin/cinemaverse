import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/layout/app-header";
import { LogoutButton } from "@/components/auth/logout-button";
import { UserList } from "@/components/community/user-card";
import { UserSearch } from "@/components/community/user-search";
import { PushToggle } from "@/components/pwa/push-toggle";
import { PersonalityBadge } from "@/components/profile/PersonalityBadge";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getUserProfileSummary, listUserReviews } from "@/lib/community/reviews";
import { getFollowCounts } from "@/lib/community/social";

export const metadata: Metadata = { title: "Profilim" };

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [summary, reviews, counts] = await Promise.all([
    getUserProfileSummary(user.id),
    listUserReviews(user.id, 20),
    getFollowCounts(user.id),
  ]);

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-gold-500/20 text-lg font-bold text-gold-300">
              {user.displayName.slice(0, 1).toLocaleUpperCase("tr")}
            </span>
            <div>
              <h1 className="font-display text-2xl font-semibold">
                {user.displayName}
              </h1>
              <p className="muted">{user.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/settings/data" className="btn btn-ghost">
              Veri yönetimi
            </Link>
            <LogoutButton />
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/wrapped" className="surface-flat px-3 py-3 group hover:border-gold-500/40 transition-colors">
            <p className="text-[0.65rem] uppercase tracking-wider text-mist-500">Sinema Wrapped</p>
            <p className="text-xl font-semibold text-mist-100 group-hover:text-gold-300 transition-colors">
              Yıl özeti
            </p>
          </Link>
          <Link href="/karakter" className="surface-flat px-3 py-3 group hover:border-gold-500/40 transition-colors">
            <p className="text-[0.65rem] uppercase tracking-wider text-mist-500">Sinema Karakterin</p>
            <p className="text-xl font-semibold text-mist-100 group-hover:text-gold-300 transition-colors">
              AI profili
            </p>
          </Link>
          <div className="surface-flat px-3 py-3">
            <p className="text-[0.65rem] uppercase tracking-wider text-mist-500">
              Kütüphane
            </p>
            <p className="text-xl font-semibold text-mist-100">
              {summary.libraryCount}
            </p>
          </div>
          <div className="surface-flat px-3 py-3">
            <p className="text-[0.65rem] uppercase tracking-wider text-mist-500">
              Puanlanan
            </p>
            <p className="text-xl font-semibold text-mist-100">
              {summary.ratedCount}
              {summary.averageRating !== null ? (
                <span className="ml-1 text-xs font-normal text-mist-500">
                  ort. {summary.averageRating.toFixed(1)}
                </span>
              ) : null}
            </p>
          </div>
          <div className="surface-flat px-3 py-3">
            <p className="text-[0.65rem] uppercase tracking-wider text-mist-500">
              İnceleme
            </p>
            <p className="text-xl font-semibold text-mist-100">
              {summary.reviewCount}
            </p>
          </div>
          <div className="surface-flat px-3 py-3">
            <p className="text-[0.65rem] uppercase tracking-wider text-mist-500">
              Kütüphane görünürlüğü
            </p>
            <p className="text-sm font-semibold text-mist-100">
              {user.libraryVisibility === "public"
                ? "Herkese açık"
                : user.libraryVisibility === "followers"
                ? "Takipçiler"
                : "Gizli"}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <PersonalityBadge />
        </div>

        <div className="mt-5">
          <PushToggle />
        </div>

        <section className="surface mt-5 p-4 sm:p-5">
          <h2 className="section-title">Sosyal</h2>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link href={`/users/${user.id}`} className="btn btn-outline">
              Profil sayfasını görüntüle
            </Link>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <UserList
              users={[]}
              viewerId={user.id}
              title={`Takipçiler (${counts.followersCount})`}
              emptyMessage="Henüz takipçi yok."
            />
            <UserList
              users={[]}
              viewerId={user.id}
              title={`Takip Edilenler (${counts.followingCount})`}
              emptyMessage="Henüz kimseyi takip etmiyorsunuz."
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <UserList
              users={[]}
              viewerId={user.id}
              title="Engellenenler"
              emptyMessage="Engellenen kullanıcı yok."
            />
            <UserList
              users={[]}
              viewerId={user.id}
              title="Sessize Alınanlar"
              emptyMessage="Sessize alınan kullanıcı yok."
            />
          </div>
        </section>

        <section className="surface mt-5 p-4 sm:p-5">
          <h2 className="section-title">Kullanıcı bul ve takip et</h2>
          <p className="muted mt-0.5 text-sm">Arama sonuçlarında takip/engelle/sessize al butonları görünür.</p>
          <UserSearch viewerId={user.id} />
        </section>

        <section className="surface mt-5 p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <h2 className="section-title">İncelemelerim</h2>
            <Link href="/library" className="btn btn-ghost">
              Kütüphanem
            </Link>
          </div>
          {reviews.length === 0 ? (
            <p className="muted mt-2">
              Henüz inceleme yazmadınız. Yapım sayfalarından inceleme
              ekleyebilirsiniz.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-ink-700">
              {reviews.map((review) => (
                <li key={review.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-mist-500">
                    <Link
                      href={`/title/${review.titleId}`}
                      className="text-gold-400 hover:underline"
                    >
                      {review.titleName}
                    </Link>
                    <span className="chip">
                      {review.visibility === "public"
                        ? "Herkese açık"
                        : review.visibility === "followers"
                        ? "Takipçiler"
                        : "Gizli"}
                    </span>
                    {review.containsSpoiler ? (
                      <span className="chip chip-rose">Spoiler</span>
                    ) : null}
                    <span>
                      {new Date(review.createdAt).toLocaleDateString("tr-TR")}
                    </span>
                  </div>
                  <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-sm text-mist-300">
                    {review.body}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}