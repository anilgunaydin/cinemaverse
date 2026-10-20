import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AppHeader } from "@/components/layout/app-header";
import { UserCard, UserList } from "@/components/community/user-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getFollowers, getFollowing, getFollowCounts, getBlocked, getMuted } from "@/lib/community/social";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const db = getDb();
  const userRows = await db
    .select({ displayName: users.displayName })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  const user = userRows[0];
  return { title: user ? `${user.displayName} (@${id})` : "Kullanıcı bulunamadı" };
}

export default async function UserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await getCurrentUser();

  const db = getDb();
  const userRows = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  const targetUser = userRows[0];
  if (!targetUser) notFound();

  const [counts, followers, following, blocked, muted] = await Promise.all([
    getFollowCounts(id),
    getFollowers(id, 50),
    getFollowing(id, 50),
    getBlocked(id, 50),
    getMuted(id, 50),
  ]);

  const isOwnProfile = viewer?.id === id;

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
          <div className="relative w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0">
            <div className="w-full h-full rounded-xl bg-gradient-to-br from-gold-500/20 to-ink-800 flex items-center justify-center">
              <span className="font-display text-4xl font-bold text-gold-300">
                {targetUser.displayName.slice(0, 1).toLocaleUpperCase("tr")}
              </span>
            </div>
          </div>

          <div className="flex-1 text-center sm:text-left">
            <h1 className="font-display text-2xl font-semibold sm:text-3xl">
              {targetUser.displayName}
            </h1>
            <p className="mt-1 text-mist-400">@{id.slice(0, 12)}</p>

            <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-4 text-sm text-mist-500">
              <span>
                <span className="font-semibold text-mist-300">{counts.followersCount}</span> takipçi
              </span>
              <span aria-hidden="true">·</span>
              <span>
                <span className="font-semibold text-mist-300">{counts.followingCount}</span> takip ediliyor
              </span>
            </div>

            {viewer && !isOwnProfile ? (
              <div className="mt-4">
                <UserCard
                  userId={id}
                  id={id}
                  displayName={targetUser.displayName}
                  viewerId={viewer.id}
                />
              </div>
            ) : isOwnProfile ? (
              <p className="mt-4 text-sm text-mist-500">Bu sizin profiliniz.</p>
            ) : (
              <p className="mt-4 text-sm text-mist-500">
                Takip etmek için{" "}
                <a href="/login" className="text-gold-400 hover:underline">
                  giriş yapın
                </a>
                .
              </p>
            )}
          </div>
        </div>

        <div className="mt-8 border-t border-ink-700">
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            <UserList
              users={followers.map((f) => ({
                id: f.userId,
                displayName: f.displayName ?? "Kullanıcı",
              }))}
              viewerId={viewer?.id ?? null}
              title={`Takipçiler (${counts.followersCount})`}
              emptyMessage="Henüz takipçi yok."
            />
            <UserList
              users={following.map((f) => ({
                id: f.userId,
                displayName: f.displayName ?? "Kullanıcı",
              }))}
              viewerId={viewer?.id ?? null}
              title={`Takip Edilenler (${counts.followingCount})`}
              emptyMessage="Henüz kimseyi takip etmiyor."
            />
            <UserList
              users={blocked.map((b) => ({
                id: b.userId,
                displayName: b.displayName ?? "Kullanıcı",
              }))}
              viewerId={viewer?.id ?? null}
              title="Engellenenler"
              emptyMessage="Engellenen kullanıcı yok."
            />
            <UserList
              users={muted.map((m) => ({
                id: m.userId,
                displayName: m.displayName ?? "Kullanıcı",
              }))}
              viewerId={viewer?.id ?? null}
              title="Sessize Alınanlar"
              emptyMessage="Sessize alınan kullanıcı yok."
            />
          </div>
        </div>
      </main>
    </>
  );
}