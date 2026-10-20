import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppHeader } from "@/components/layout/app-header";
import { EvaluationCard } from "@/components/catalog/evaluation-card";
import { InlineNameList } from "@/components/catalog/inline-name-list";
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

  const { title, genres, credits, seasons, communityRating, userEntry } = data;
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

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-6 sm:py-6">
        {/* Breadcrumb */}
        <nav className="mb-3 flex items-center gap-2 text-xs text-mist-500">
          <Link href="/" className="hover:text-mist-300">
            Keşfet
          </Link>
          <span aria-hidden>/</span>
          <Link href="/search" className="hover:text-mist-300">
            Arama
          </Link>
          <span aria-hidden>/</span>
          <span className="truncate text-mist-400">{displayTitle}</span>
        </nav>

        {/* Kompakt hero */}
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
        />

        {/* Ust blok: Konu | Ekip | Degerlendirmen - yan yana */}
        <div className="grid content-start items-start gap-4 lg:grid-cols-3">
          {/* Konu */}
          <section className="surface p-4">
            <h2 className="section-title">Konu</h2>
            {title.overview ? (
              <p className="mt-2 line-clamp-8 text-sm leading-relaxed text-mist-300">
                {title.overview}
              </p>
            ) : (
              <p className="muted mt-2 text-sm italic">
                Kaynakta açıklama bulunmuyor.
              </p>
            )}

            {seasons.length > 0 ? (
              <div className="mt-3 border-t border-ink-700 pt-2.5">
                <h3 className="label">Sezonlar</h3>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
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
          </section>

          {/* Ekip - isimler tek satir, fazlasi hover'da */}
          {credits.length > 0 ? (
            <section className="surface p-4">
              <h2 className="section-title">Ekip</h2>
              <div className="mt-2.5 flex flex-col gap-2.5">
                {(
                  ["director", "creator", "writer", "actor", "composer"] as const
                ).map((role) =>
                  groupedCredits[role]?.length ? (
                    <div key={role}>
                      <p className="label">{ROLE_LABELS[role]}</p>
                      <InlineNameList
                        label={ROLE_LABELS[role]}
                        names={groupedCredits[role].map((credit) => credit.personName)}
                        maxChars={role === "actor" ? 60 : 110}
                      />
                    </div>
                  ) : null
                )}
              </div>
            </section>
          ) : null}

          {/* Değerlendirmen: kişisel hafıza + incelemen + topluluk incelemeleri */}
          <EvaluationCard
            titleId={title.id}
            titleName={displayTitle}
            isSeries={title.kind === "series"}
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

        {/* Alt blok */}
        <div className="mt-4 grid content-start items-start gap-4 lg:grid-cols-2 xl:grid-cols-3">

          {/* Fragman */}
          {title.trailerUrl ? (
            <section className="surface overflow-hidden p-4">
              <h2 className="section-title mb-3">Fragman</h2>
              <TrailerSection trailerUrl={title.trailerUrl} />
            </section>
          ) : null}

          {/* İncelemeler artik yukarida birlestirildi */}

          {/* İnternet Yorumları */}
          {externalComments.total > 0 ? (
            <ExternalCommentsSection
              local={externalComments.local}
              foreign={externalComments.foreign}
              total={externalComments.total}
            />
          ) : null}

          {/* Tartışmalar */}
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

          {/* AI & Araştırma */}
          <div className="flex flex-col gap-4">
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
        </div>
      </main>
    </>
  );
}
