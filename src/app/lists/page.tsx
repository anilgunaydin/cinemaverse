import type { Metadata } from "next";
import Link from "next/link";

import { AppHeader } from "@/components/layout/app-header";
import { ListGrid, ListForm } from "@/components/community/list-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listPublicLists, listUserLists } from "@/lib/community/lists";

export const metadata: Metadata = { title: "Listeler" };

export default async function ListsPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string }>;
}) {
  const user = await getCurrentUser();
  const { userId } = await searchParams;

  const isOwnProfile = userId && user && userId === user.id;
  const targetUserId = userId ?? user?.id;

  let lists: Awaited<ReturnType<typeof listPublicLists>> = [];
  if (targetUserId) {
    if (isOwnProfile) {
      lists = await listUserLists(targetUserId, user.id);
    } else if (userId) {
      lists = await listUserLists(userId, user?.id ?? null);
    } else {
      lists = await listPublicLists(40);
    }
  } else {
    lists = await listPublicLists(40);
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <p className="text-[0.68rem] uppercase tracking-[0.22em] text-gold-400">
          Topluluk
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">
          Kullanıcı Listeleri
        </h1>

        {userId ? (
          <p className="muted mt-1">
            {isOwnProfile
              ? "Kendi listeleriniz. Özel listeleriniz de burada görünür."
              : "Bu kullanıcının herkese açık listeleri."}
          </p>
        ) : (
          <p className="muted mt-1">
            Kullıcıların oluşturduğu herkese açık listeler. Kendi listelerinizi
            yönetmek için{" "}
            <Link href="/profile" className="text-gold-400 hover:underline">
              profilinizi
            </Link>{" "}
            ziyaret edin.
          </p>
        )}

        {user && (isOwnProfile || !userId) ? (
          <div className="mt-6 surface p-4 sm:p-5">
            <h2 className="section-title">Yeni liste oluştur</h2>
            <ListForm />
          </div>
        ) : null}

        <div className="mt-6">
          <ListGrid
            lists={lists}
            viewerId={user?.id ?? null}
            emptyMessage={
              userId
                ? isOwnProfile
                  ? "Henüz liste oluşturmadınız. Yukarıdan yeni bir liste oluşturabilirsiniz."
                  : "Bu kullanıcının herkese açık listesi yok."
                : "Henüz herkese açık liste yok."
            }
          />
        </div>
      </main>
    </>
  );
}