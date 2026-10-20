import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { WatchProviders } from "@/components/catalog/watch-providers";
import { AppHeader } from "@/components/layout/app-header";
import { LibraryEditor } from "@/components/library/library-editor";
import { ResearchPanel } from "@/components/research/research-panel";
import { AiDiscussion } from "@/components/ai/ai-discussion";
import { ReviewPanel } from "@/components/community/review-panel";
import { ThreadList } from "@/components/community/thread-list";
import { AddToListButton } from "@/components/library/add-to-list-button";
import { loadTitlePageData } from "@/lib/catalog/page-data";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getAiStatus } from "@/lib/ai/provider";
import { getConversationMessages, listConversations } from "@/lib/ai/conversation";
import { listResearchSessions } from "@/lib/research/service";
import { listReviewsForTitle } from "@/lib/community/reviews";
import { listExternalComments } from "@/lib/community/external-comments";
import ExternalCommentsSection from "./external-comments-section";
import TrailerSection from "./trailer-section";
import { listThreads } from "@/lib/community/discussions";
import { getFranchisesForTitle } from "@/lib/community/franchises";

const KIND_LABELS: Record<string, string> = {
  movie: "Film",
  series: "Dizi",
  season: "Sezon",
  episode: "Bölüm",
  franchise: "Seri",
};

const ROLE_LABELS: Record<string, string> = {
  director: "Yönetmen",
  writer: "Senarist",
  creator: "Yaratıcı",
  actor: "Oyuncu",
  composer: "Müzik",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await loadTitlePageData(id);
  if (!data) return { title: "Yapım bulunamadı" };
  return {
    title: data.title.localizedTitle ?? data.title.originalTitle,
    description: data.title.overview?.slice(0, 160) ?? undefined,
  };
}

export default async function TitlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const data = await loadTitlePageData(id, user?.id);
  const aiStatus = getAiStatus();

  if (!data) notFound();

  const { title, genres, credits, seasons, communityRating, userEntry } = data;
  const reviews = await listReviewsForTitle(title.id, user?.id);
  const externalComments = await listExternalComments(title.id);
  const threads = await listThreads({
    titleId: title.id,
    viewerId: user?.id ?? null,
    limit: 5,
  });
  const titleFranchises = await getFranchisesForTitle(title.id);

  const aiStatusView = {
    enabled: aiStatus.enabled,
    provider: aiStatus.provider,
    model: aiStatus.model,
    reason: aiStatus.reason,
  };

  let researchSessions: Awaited<ReturnType<typeof listResearchSessions>> = [];
  let aiConversations: Awaited<ReturnType<typeof listConversations>> = [];
  let aiMessages: NonNullable<
    Awaited<ReturnType<typeof getConversationMessages>>
  >["messages"] = [];

  if (user) {
    [researchSessions, aiConversations] = await Promise.all([
      listResearchSessions(user.id, title.id),
      listConversations(user.id, title.id),
    ]);
    const firstConversation = aiConversations[0];
    if (firstConversation) {
      const conversation = await getConversationMessages(user.id, firstConversation.id);
      if (conversation) aiMessages = conversation.messages;
    }
  }

  const groupedCredits = credits.reduce<Record<string, typeof credits>>(
    (accumulator, credit) => {
      const list = accumulator[credit.role] ?? [];
      list.push(credit);
      accumulator[credit.role] = list;
      return accumulator;
    },
    {},
  );

  const displayTitle = title.localizedTitle ?? title.originalTitle;

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-4 flex items-center gap-2 text-xs text-mist-500">
          <Link href="/" className="hover:text-mist-300">
            Keşfet
          </Link>
          <span aria-hidden="true">/</span>
          <Link href="/search" className="hover:text-mist-300">
            Arama
          </Link>
          <span aria-hidden="true">/</span>
          <span className="truncate text-mist-400">{displayTitle}</span>
        </div>

        <div className="flex flex-col gap-6 md:flex-row">
          <div className="mx-auto w-44 shrink-0 sm:w-52 md:mx-0">
            <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl border border-ink-700 bg-ink-800">
              {title.posterUrl ? (
                <Image
                  src={title.posterUrl}
                  alt={`${displayTitle} posteri`}
                  fill
                  sizes="208px"
                  className="object-cover"
                  priority
                  unoptimized
                />
              ) : (
                <div className="grid h-full place-items-center px-3 text-center text-xs text-mist-500">
                  Bu yapım için kaynakta poster bulunmuyor.
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="chip chip-gold">{KIND_LABELS[title.kind] ?? title.kind}</span>
              {title.releaseYear ? <span className="chip">{title.releaseYear}</span> : null}
              {title.runtimeMinutes ? (
                <span className="chip">{title.runtimeMinutes} dk</span>
              ) : null}
              {title.originalLanguage ? (
                <span className="chip">{title.originalLanguage}</span>
              ) : null}
              {title.metadataVerified ? (
                <span className="chip chip-jade" title="Veri kaynakta doğrulandı">
                  Kaynakta doğrulandı
                </span>
              ) : null}
            </div>

            <h1 className="mt-2 font-display text-3xl font-semibold leading-tight sm:text-4xl">
              {displayTitle}
            </h1>
            {title.localizedTitle && title.localizedTitle !== title.originalTitle ? (
              <p className="mt-1 text-sm text-mist-400">{title.originalTitle}</p>
            ) : null}

            {genres.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {genres.map((genre) => (
                  <Link
                    key={genre.slug}
                    href={`/?genre=${genre.slug}`}
                    className="chip hover:border-gold-500/40 hover:text-gold-300"
                  >
                    {genre.nameTr}
                  </Link>
                ))}
              </div>
            ) : null}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="surface-flat px-3 py-2">
                <p className="text-[0.65rem] uppercase tracking-wider text-mist-500">
                  Sizin puanınız
                </p>
                <p className="text-lg font-semibold text-mist-100">
                  {userEntry?.rating ? `${userEntry.rating}/10` : "Verilmedi"}
                </p>
              </div>
              <div className="surface-flat px-3 py-2">
                <p className="text-[0.65rem] uppercase tracking-wider text-mist-500">
                  CinemaVerse kullanıcı ortalaması
                </p>
                <p className="text-lg font-semibold text-mist-100">
                  {communityRating.count > 0 && communityRating.average !== null
                    ? `${communityRating.average.toFixed(1)}/10`
                    : "Henüz puan yok"}
                  {communityRating.count > 0 ? (
                    <span className="ml-1 text-xs font-normal text-mist-500">
                      ({communityRating.count} kişi)
                    </span>
                  ) : null}
                </p>
              </div>
            </div>

            {title.externalRating ? (
              <p className="mt-2 text-xs text-mist-500">
                Harici platform puanı:{" "}
                <span className="font-semibold text-mist-300">
                  {title.externalRating.toFixed(1)}
                </span>{" "}
                ({title.externalRatingSource}). Bu puan kullanıcı puanlarından ayrı
                tutulur.
              </p>
            ) : null}

            {titleFranchises.length > 0 ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <p className="text-[0.65rem] uppercase tracking-wider text-mist-500">
                  Franchise
                </p>
                {titleFranchises.map((fr) => (
                  <Link
                    key={fr.id}
                    href={`/franchises/${fr.id}`}
                    className="chip chip-gold hover:border-gold-500/40 hover:text-gold-300"
                  >
                    {fr.name}
                  </Link>
                ))}
              </div>
            ) : null}

            <div className="mt-4 flex items-center gap-2">
              <AddToListButton
                titleId={title.id}
                userId={user?.id ?? null}
              />
            </div>

            {title.overview ? (
              <p className="mt-4 text-sm leading-relaxed text-mist-300">
                {title.overview}
              </p>
            ) : (
              <p className="mt-4 text-sm italic text-mist-500">
                Kaynakta açıklama bulunmuyor.
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-mist-500">
              <span>
                Veri sağlayıcı:{" "}
                <span className="text-mist-300">{title.metadataProvider}</span>
              </span>
              {title.imdbId ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>IMDb: {title.imdbId}</span>
                </>
              ) : null}
              {title.wikidataId ? (
                <>
                  <span aria-hidden="true">·</span>
                  <a
                    href={`https://www.wikidata.org/wiki/${title.wikidataId}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-gold-400 hover:underline"
                  >
                    Wikidata kaydı
                  </a>
                </>
              ) : null}
              {title.tvmazeId ? (
                <>
                  <span aria-hidden="true">·</span>
                  <a
                    href={`https://www.tvmaze.com/shows/${title.tvmazeId}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-gold-400 hover:underline"
                  >
                    TVmaze kaydı
                  </a>
                </>
              ) : null}
              {title.homepageUrl ? (
                <>
                  <span aria-hidden="true">·</span>
                  <a
                    href={title.homepageUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-gold-400 hover:underline"
                  >
                    Resmî site
                  </a>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[1.15fr_1fr]">
          <div className="flex flex-col gap-5">
            {Object.keys(groupedCredits).length > 0 ? (
              <section className="surface p-4 sm:p-5">
                <h2 className="section-title">Ekip</h2>
                <div className="mt-3 flex flex-col gap-3">
                  {(["director", "creator", "writer", "actor", "composer"] as const).map(
                    (role) =>
                      groupedCredits[role]?.length ? (
                        <div key={role}>
                          <p className="label">{ROLE_LABELS[role]}</p>
                          <p className="text-sm text-mist-300">
                            {groupedCredits[role]
                              .slice(0, 12)
                              .map((credit) => credit.personName)
                              .join(", ")}
                            {groupedCredits[role].length > 12
                              ? ` ve ${groupedCredits[role].length - 12} kişi daha`
                              : ""}
                          </p>
                        </div>
                      ) : null,
                  )}
                </div>
              </section>
            ) : null}

            {seasons.length > 0 ? (
              <section className="surface p-4 sm:p-5">
                <h2 className="section-title">Sezonlar</h2>
                <p className="muted mt-0.5">
                  Sezonlar ayrı kayıtlardır; diziye verdiğiniz puan sezonlara
                  otomatik dağıtılmaz.
                </p>
                <ul className="mt-3 divide-y divide-ink-700">
                  {seasons.map((season) => (
                    <li key={season.id}>
                      <Link
                        href={`/title/${season.id}`}
                        className="flex items-center justify-between gap-3 py-2.5 text-sm transition-colors hover:text-gold-300"
                      >
                        <span className="text-mist-200">
                          {season.seasonNumber}. Sezon
                        </span>
                        <span className="text-xs text-mist-500">
                          {season.releaseYear ?? "Yıl bilinmiyor"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          <div className="flex flex-col gap-5">
            <ReviewPanel
              titleId={title.id}
              titleName={displayTitle}
              isSeries={title.kind === "series"}
              isLoggedIn={Boolean(user)}
              viewerId={user?.id ?? null}
              viewer={{
                status: userEntry?.status ?? null,
                season: userEntry?.progressSeason ?? null,
                episode: userEntry?.progressEpisode ?? null,
              }}
              initialReviews={reviews}
            />
            <LibraryEditor
              titleId={title.id}
              titleName={displayTitle}
              isSeries={title.kind === "series"}
              isLoggedIn={Boolean(user)}
              entry={
                userEntry
                  ? {
                      id: userEntry.id,
                      status: userEntry.status,
                      rating: userEntry.rating,
                      watchedAt: userEntry.watchedAt,
                      watchedPeriod: userEntry.watchedPeriod,
                      notes: userEntry.notes,
                      likedAspects: userEntry.likedAspects,
                      dislikedAspects: userEntry.dislikedAspects,
                      memorableScenes: userEntry.memorableScenes,
                      rewatchIntent: userEntry.rewatchIntent,
                      progressSeason: userEntry.progressSeason,
                      progressEpisode: userEntry.progressEpisode,
                      isFavorite: userEntry.isFavorite,
                    }
                  : null
              }
            />
          </div>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <ResearchPanel
            titleId={title.id}
            isLoggedIn={Boolean(user)}
            aiEnabled={aiStatus.enabled}
            initialSessions={researchSessions}
          />
          <AiDiscussion
            titleId={title.id}
            isLoggedIn={Boolean(user)}
            defaultSeason={userEntry?.progressSeason ?? null}
            status={aiStatusView}
            initialConversations={aiConversations}
            initialMessages={aiMessages}
          />
        </div>

        <div className="mt-8">
          {title.trailerUrl ? (
            <div className="mb-8 max-w-3xl">
              <TrailerSection trailerUrl={title.trailerUrl} />
            </div>
          ) : null}
          <div className="mb-8">
            <WatchProviders titleId={title.id} />
          </div>
          {externalComments.total > 0 ? (
            <div className="mb-8">
              <ExternalCommentsSection
                local={externalComments.local}
                foreign={externalComments.foreign}
                total={externalComments.total}
              />
            </div>
          ) : null}
          <ThreadList
            threads={threads}
            viewer={{
              status: userEntry?.status ?? null,
              season: userEntry?.progressSeason ?? null,
              episode: userEntry?.progressEpisode ?? null,
            }}
            viewerId={user?.id ?? null}
            isLoggedIn={Boolean(user)}
            titleId={title.id}
            titleName={displayTitle}
          />
          <p className="mt-2 text-xs text-mist-500">
            <Link
              href={`/discussions?titleId=${title.id}`}
              className="text-gold-400 hover:underline"
            >
              Bu yapımla ilgili tüm tartışmalar
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
