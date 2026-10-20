import type { Metadata } from "next";
import Link from "next/link";

import { AppHeader } from "@/components/layout/app-header";
import { ThreadList } from "@/components/community/thread-list";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listThreads } from "@/lib/community/discussions";
import { getTitleById } from "@/lib/catalog/service";

export const metadata: Metadata = { title: "Tartışmalar" };

export default async function DiscussionsPage({
  searchParams,
}: {
  searchParams: Promise<{ titleId?: string }>;
}) {
  const user = await getCurrentUser();
  const { titleId } = await searchParams;

  const threads = await listThreads({
    titleId: titleId ?? undefined,
    viewerId: user?.id ?? null,
    limit: 40,
  });

  const title = titleId ? await getTitleById(titleId) : null;
  const titleName = title
    ? title.localizedTitle ?? title.originalTitle
    : null;

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <p className="text-[0.68rem] uppercase tracking-[0.22em] text-gold-400">
          Topluluk
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">
          Tartışmalar
        </h1>
        <p className="muted mt-1">
          {titleName ? (
            <>
              <Link
                href={`/title/${titleId}`}
                className="text-gold-400 hover:underline"
              >
                {titleName}
              </Link>{" "}
              hakkındaki konular.
            </>
          ) : (
            "Filmler, diziler ve genel sinema üzerine gerçek kullanıcı konuları. Spoiler içeren içerikler izleme ilerlemenize göre gizlenir."
          )}
        </p>

        {titleId ? (
          <p className="mt-2 text-xs text-mist-500">
            <Link href="/discussions" className="text-gold-400 hover:underline">
              Tüm tartışmaları gör
            </Link>
          </p>
        ) : null}

        <div className="mt-6">
          <ThreadList
            threads={threads}
            viewer={{ status: null, season: null, episode: null }}
            viewerId={user?.id ?? null}
            isLoggedIn={Boolean(user)}
            titleId={titleId ?? null}
            titleName={titleName}
          />
        </div>
      </main>
    </>
  );
}
