import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppHeader } from "@/components/layout/app-header";
import { EvaluationCard } from "@/components/catalog/evaluation-card";
import { InlineNameList } from "@/components/catalog/inline-name-list";
import { DetailCard } from "@/components/catalog/detail-card";
import { ResearchPanel } from "@/components/research/research-panel";
import { AiDiscussion } from "@/components/ai/ai-discussion";
import { ThreadList } from "@/components/community/thread-list";
import { loadTitlePageData } from "@/lib/catalog/page-data";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getAiStatus } from "@/lib/ai/provider";
import { getConversationMessages, listConversations } from "@/lib/ai/conversation";
import { listResearchSessions } from "@/lib/research/service";
import { listReviewsForTitle } from "@/lib/community/reviews";
import { listExternalComments } from "@/lib/community/external-comments";
import { listThreads } from "@/lib/community/discussions";
import { getFranchisesForTitle } from "@/lib/community/franchises";
import { getWatchProviders } from "@/lib/watch-providers/service";
import { TitleHero } from "./title-hero";
import ExternalCommentsSection from "./external-comments-section";
import TrailerSection from "./trailer-section";

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

  const {
    title,
    genres,
    credits,
    aliases,
    seasons,
    communityRating,
    userEntry,
  } = data;
  const displayTitle = title.localizedTitle ?? title.originalTitle;

  const [reviews, externalComments, threads, titleFranchises, providers] =
    await Promise.all([
      listReviewsForTitle(title.id, user?.id),
      listExternalComments(title.id),
      listThreads({
        titleId: title.id,
        viewerId: user?.id ?? null,
        limit: 10,
      }),
      getFranchisesForTitle(title.id),
      getWatchProviders(title.id),
    ]);

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
    {}
  );

  const otherNames = Array.from(
    new Set(
      aliases
        .map((alias) => alias.name?.trim())
        .filter(
          (name): name is string =>
            Boolean(name) &&
            name !== displayTitle &&
            name !== title.originalTitle
        )
    )
  ).slice(0, 10);

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl px-3 pb-12 pt-3 sm:px-6 sm:pt-5">
        {/* Breadcrumb */}
        <nav
          aria-label="Sayfa yolu"
          className="mb-2.5 flex min-w-0 items-center gap-2 text-xs text-mist-500"
        >
          <Link href="/" className="shrink-0 hover:text-mist-300">
            Keşfet
          </Link>
          <span aria-hidden className="text-mist-600">
            /
          </span>
          <Link href="/search" className="shrink-0 hover:text-mist-300">
            Arama
          </Link>
          <span aria-hidden className="text-mist-600">
            /
          </span>
          <span className="truncate text-mist-300">{displayTitle}</span>
        </nav>

        {/* Hero */}
        <TitleHero
          title={{
            id: title.id,
            kind: title.kind,
            originalTitle: title.originalTitle,
            localizedTitle: title.localizedTitle,
            originalLanguage: title.originalLanguage,
            overview: title.overview,
            releaseYear: title.releaseYear,
            runtimeMinutes: title.runtimeMinutes,
            posterUrl: title.posterUrl,
            backdropUrl: title.backdropUrl,
            externalRating: title.externalRating,
            externalRatingSource: title.externalRatingSource,
            externalRatingCount: title.externalRatingCount,
            metadataVerified: title.metadataVerified,
            metadataProvider: title.metadataProvider,
            imdbId: title.imdbId,
            wikidataId: title.wikidataId,
            homepageUrl: title.homepageUrl,
          }}
          genres={genres.map((genre) => ({
            slug: genre.slug,
            nameTr: genre.nameTr,
          }))}
          providers={providers}
          communityRating={communityRating}
          userRating={userEntry?.rating ?? null}
          userId={user?.id ?? null}
          franchiseNames={titleFranchises.map((franchise) => franchise.name)}
          hasTrailer={Boolean(title.trailerUrl)}
        />

        {/* 1. satır — konu: değişken uzunlukta olduğu için tam genişlik */}
        <div
          className="mt-3 animate-fade-up sm:mt-4"
          style={{ animationDelay: "40ms" }}
        >
          <DetailCard
            icon="plot"
            title="Konu"
            meta={
              seasons.length > 0 ? `${seasons.length} sezon` : undefined
            }
          >
            <div className="flex flex-col gap-3">
              {title.overview ? (
                <p className="max-w-[85ch] text-sm leading-relaxed text-mist-300">
                  {title.overview}
                </p>
              ) : (
                <p className="text-sm italic text-mist-500">
                  Kaynakta açıklama bulunmuyor.
                </p>
              )}

              {seasons.length > 0 || otherNames.length > 0 ? (
                <div className="flex flex-wrap items-start gap-x-8 gap-y-3 border-t border-ink-700/60 pt-2.5">
                  {seasons.length > 0 ? (
                    <div>
                      <p className="label">Sezonlar</p>
                      <ul className="flex flex-wrap gap-1.5">
                        {seasons.map((season) => (
                          <li key={season.id}>
                            <Link
                              href={`/title/${season.id}`}
                              className="flex items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-900 px-2 py-0.5 text-[0.7rem] text-mist-300 transition-colors hover:border-gold-500/40 hover:text-gold-300"
                            >
                              <span className="font-semibold">
                                {season.seasonNumber}. Sezon
                              </span>
                              <span className="text-mist-500">
                                {season.releaseYear ?? "—"}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {otherNames.length > 0 ? (
                    <div className="min-w-0">
                      <p className="label">Diğer adlar</p>
                      <ul className="flex flex-wrap gap-1.5">
                        {otherNames.map((name) => (
                          <li
                            key={name}
                            className="max-w-full truncate rounded-md border border-ink-700 bg-ink-900/70 px-1.5 py-0.5 text-[0.7rem] text-mist-400"
                            title={name}
                          >
                            {name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </DetailCard>
        </div>

        {/* 2. satır — ekip + değerlendirmen */}
        <div
          className="mt-3 grid animate-fade-up items-stretch gap-3 sm:mt-4 sm:gap-4 lg:h-[620px] lg:grid-cols-12"
          style={{ animationDelay: "80ms" }}
        >
          {/* Ekip */}
          {credits.length > 0 ? (
            <DetailCard
              icon="cast"
              title="Ekip"
              meta={`${credits.length} kişi`}
              className="lg:col-span-5"
              bodyClassName="p-0"
            >
              <div className="flex min-h-0 flex-1 flex-col p-4 pr-2">
                <div className="flex flex-col gap-2.5">
                  {(
                    ["director", "creator", "writer", "composer"] as const
                  ).map((role) =>
                    groupedCredits[role]?.length ? (
                      <div key={role}>
                        <p className="label">{ROLE_LABELS[role]}</p>
                        <InlineNameList
                          label={ROLE_LABELS[role]}
                          names={groupedCredits[role].map(
                            (credit) => credit.personName
                          )}
                          maxChars={80}
                        />
                      </div>
                    ) : null
                  )}
                </div>

                {groupedCredits.actor?.length ? (
                  <div className="mt-2.5 flex min-h-0 flex-1 flex-col border-t border-ink-700/70 pt-2.5">
                    <p className="label">
                      Oyuncular{" "}
                      <span className="font-normal normal-case tracking-normal text-mist-500">
                        ({groupedCredits.actor.length})
                      </span>
                    </p>
                    <ul className="min-h-0 flex-1 overflow-y-auto pr-1">
                      {groupedCredits.actor.map((credit) => (
                        <li
                          key={`${credit.personId}-${credit.characterName}`}
                          className="flex items-baseline gap-2 border-b border-ink-800/70 py-1 last:border-0"
                        >
                          <span
                            className="min-w-0 flex-1 truncate text-[0.82rem] text-mist-300"
                            title={credit.personName}
                          >
                            {credit.personName}
                          </span>
                          {credit.characterName ? (
                            <span
                              className="max-w-[48%] shrink-0 truncate text-[0.68rem] text-mist-500"
                              title={credit.characterName}
                            >
                              {credit.characterName}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </DetailCard>
          ) : null}

          {/* Değerlendirmen: hafıza + incelemen + topluluk */}
          <EvaluationCard
            titleId={title.id}
            titleName={displayTitle}
            isSeries={title.kind === "series"}
            className={credits.length > 0 ? "lg:col-span-7" : "lg:col-span-12"}
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
            viewer={{
              userId: user?.id ?? "",
              status: userEntry?.status ?? null,
              season: userEntry?.progressSeason ?? null,
              episode: userEntry?.progressEpisode ?? null,
            }}
            initialReviews={reviews}
          />
        </div>

        {/* 3. satır — medya ve dış yorumlar */}
        <div
          className="mt-3 grid animate-fade-up items-stretch gap-3 sm:mt-4 sm:gap-4 lg:grid-cols-12"
          style={{ animationDelay: "100ms" }}
        >
          {title.trailerUrl ? (
            <DetailCard
              id="fragman"
              icon="play"
              title="Fragman"
              className="lg:col-span-6 lg:max-h-[420px]"
              bodyClassName="justify-center"
              action={
                <a
                  href={title.trailerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[0.7rem] text-gold-400 transition-colors hover:text-gold-300"
                >
                  YouTube ↗
                </a>
              }
            >
              <TrailerSection trailerUrl={title.trailerUrl} showLink={false} />
              <p className="mt-2 text-[0.68rem] text-mist-500">
                Fragman YouTube üzerinden oynatılır — reklam ve altyazı
                seçenekleri YouTube&apos;a aittir.
              </p>
            </DetailCard>
          ) : null}

          {externalComments.total > 0 ? (
            <ExternalCommentsSection
              local={externalComments.local}
              foreign={externalComments.foreign}
              total={externalComments.total}
              className={
                title.trailerUrl
                  ? "lg:col-span-6 lg:max-h-[420px]"
                  : "lg:col-span-12 lg:max-h-[420px]"
              }
            />
          ) : null}
        </div>

        {/* 4. satır — topluluk ve AI */}
        <div
          className="mt-3 grid animate-fade-up items-stretch gap-3 sm:mt-4 sm:gap-4 lg:grid-cols-3"
          style={{ animationDelay: "160ms" }}
        >
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
            className="lg:max-h-[540px]"
          />

          <ResearchPanel
            titleId={title.id}
            isLoggedIn={Boolean(user)}
            aiEnabled={aiStatus.enabled}
            initialSessions={researchSessions}
            className="lg:max-h-[540px]"
          />

          <AiDiscussion
            titleId={title.id}
            isLoggedIn={Boolean(user)}
            defaultSeason={userEntry?.progressSeason ?? null}
            status={aiStatusView}
            initialConversations={aiConversations}
            initialMessages={aiMessages}
            className="lg:max-h-[540px]"
          />
        </div>
      </main>
    </>
  );
}
