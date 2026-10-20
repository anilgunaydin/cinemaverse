import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { AppHeader } from "@/components/layout/app-header";
import { ThreadDetail } from "@/components/community/thread-detail";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getThreadDetail } from "@/lib/community/discussions";
import { getDb } from "@/lib/db";
import { libraryEntries } from "@/lib/db/schema";
import type { SpoilerViewer } from "@/lib/spoilers/rules";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const thread = await getThreadDetail(id);
  return { title: thread ? thread.heading : "Tartışma bulunamadı" };
}

async function getViewerProgress(
  userId: string | undefined,
  titleId: string | null,
): Promise<SpoilerViewer> {
  if (!userId || !titleId) return { status: null, season: null, episode: null };
  const db = getDb();
  const rows = await db
    .select({
      status: libraryEntries.status,
      season: libraryEntries.progressSeason,
      episode: libraryEntries.progressEpisode,
    })
    .from(libraryEntries)
    .where(
      and(
        eq(libraryEntries.userId, userId),
        eq(libraryEntries.titleId, titleId),
      ),
    )
    .limit(1);
  const row = rows[0];
  return {
    status: row?.status ?? null,
    season: row?.season ?? null,
    episode: row?.episode ?? null,
  };
}

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const thread = await getThreadDetail(id, user?.id ?? null);
  if (!thread) notFound();

  const viewer = await getViewerProgress(user?.id, thread.titleId);

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-4 flex items-center gap-2 text-xs text-mist-500">
          <Link href="/discussions" className="hover:text-mist-300">
            Tartışmalar
          </Link>
          {thread.titleId ? (
            <>
              <span aria-hidden="true">/</span>
              <Link
                href={`/discussions?titleId=${thread.titleId}`}
                className="truncate hover:text-mist-300"
              >
                {thread.titleName}
              </Link>
            </>
          ) : null}
        </div>

        <ThreadDetail
          thread={thread}
          viewer={viewer}
          viewerId={user?.id ?? null}
          isLoggedIn={Boolean(user)}
        />
      </main>
    </>
  );
}
