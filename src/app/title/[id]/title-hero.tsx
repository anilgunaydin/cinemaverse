import Image from "next/image";
import Link from "next/link";

import { AddToListButton } from "@/components/library/add-to-list-button";
import {
  MONETIZATION_LABELS,
  type WatchProviderEntry,
} from "@/lib/watch-providers/service";

type HeroTitle = {
  id: string;
  kind: string;
  originalTitle: string;
  localizedTitle: string | null;
  originalLanguage: string | null;
  overview: string | null;
  releaseYear: number | null;
  runtimeMinutes: number | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  externalRating: number | null;
  externalRatingSource: string | null;
  externalRatingCount: number | null;
  metadataVerified: boolean;
  metadataProvider: string | null;
  imdbId: string | null;
  wikidataId: string | null;
  homepageUrl: string | null;
};

type HeroGenre = { slug: string; nameTr: string };

export function TitleHero({
  title,
  genres,
  providers,
  communityRating,
  userRating,
  userId,
  franchiseNames,
}: {
  title: HeroTitle;
  genres: HeroGenre[];
  providers: WatchProviderEntry[];
  communityRating: { average: number | null; count: number };
  userRating: number | null;
  userId: string | null;
  franchiseNames: string[];
}) {
  const displayTitle = title.localizedTitle ?? title.originalTitle;
  const showOriginal =
    title.localizedTitle && title.localizedTitle !== title.originalTitle;

  const kindLabel: Record<string, string> = {
    movie: "Film",
    series: "Dizi",
    season: "Sezon",
    episode: "Bölüm",
    franchise: "Seri",
  };

  // Platformlari once "abonelikle" olanlara gore sirala
  const sortedProviders = [...providers].sort((a, b) => {
    const order = ["flatrate", "ads", "free", "rent", "buy"];
    const d = order.indexOf(a.monetizationType) - order.indexOf(b.monetizationType);
    if (d !== 0) return d;
    return a.displayPriority - b.displayPriority;
  });
  const primaryProviders = sortedProviders.slice(0, 5);
  const extraProviders = sortedProviders.length - primaryProviders.length;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
      {/* Arka plan: backdrop bulanik + karartma */}
      {title.backdropUrl && (
        <>
          <Image
            src={title.backdropUrl}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-30 blur-[2px] scale-105"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/90 to-ink-950/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-transparent to-ink-950/50" />
        </>
      )}

      <div className="relative flex gap-4 p-4 sm:gap-5 sm:p-5">
        {/* Poster */}
        <div className="w-24 shrink-0 sm:w-32">
          <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg border border-ink-600 bg-ink-800 shadow-xl">
            {title.posterUrl ? (
              <Image
                src={title.posterUrl}
                alt={`${displayTitle} posteri`}
                fill
                sizes="128px"
                className="object-cover"
                priority
                unoptimized
              />
            ) : (
              <div className="grid h-full place-items-center bg-gradient-to-br from-ink-800 to-ink-900">
                <span className="font-display text-2xl font-bold text-mist-600">
                  {displayTitle.slice(0, 2).toLocaleUpperCase("tr")}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Bilgi */}
        <div className="min-w-0 flex-1">
          {/* Üst satır: rozetler */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="chip chip-gold">{kindLabel[title.kind] ?? title.kind}</span>
            {title.releaseYear && <span className="chip">{title.releaseYear}</span>}
            {title.runtimeMinutes && (
              <span className="chip">{title.runtimeMinutes} dk</span>
            )}
            {title.originalLanguage && (
              <span className="chip uppercase">{title.originalLanguage}</span>
            )}
            {title.metadataVerified && (
              <span className="chip chip-jade" title="Veri kaynakta doğrulandı">
                ✓ Doğrulandı
              </span>
            )}
            {franchiseNames.map((name) => (
              <span key={name} className="chip chip-gold">
                {name}
              </span>
            ))}
          </div>

          {/* Başlık */}
          <h1 className="mt-2 font-display text-2xl font-bold leading-tight text-mist-50 sm:text-3xl">
            {displayTitle}
          </h1>
          {showOriginal && (
            <p className="mt-0.5 text-sm text-mist-400">{title.originalTitle}</p>
          )}

          {/* Türler */}
          {genres.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {genres.slice(0, 6).map((genre) => (
                <Link
                  key={genre.slug}
                  href={`/?genre=${genre.slug}`}
                  className="rounded-md border border-ink-600 bg-ink-800/70 px-1.5 py-0.5 text-[0.7rem] text-mist-300 transition-colors hover:border-gold-500/40 hover:text-gold-300"
                >
                  {genre.nameTr}
                </Link>
              ))}
            </div>
          )}

          {/* Özet istatistikler */}
          <div className="mt-3 grid grid-cols-3 gap-2 sm:max-w-lg">
            <StatBlock
              label="Sizin puanınız"
              value={userRating != null ? `${userRating}` : "—"}
              suffix={userRating != null ? "/10" : ""}
              highlight={userRating != null}
            />
            <StatBlock
              label="CinemaVerse ort."
              value={
                communityRating.average != null
                  ? communityRating.average.toFixed(1)
                  : "—"
              }
              suffix={communityRating.average != null ? "/10" : ""}
              note={
                communityRating.count > 0
                  ? `${communityRating.count} kişi`
                  : "henüz puan yok"
              }
            />
            <StatBlock
              label={
                title.externalRatingSource
                  ? `Harici puan (${title.externalRatingSource})`
                  : "Harici puan"
              }
              value={
                title.externalRating != null
                  ? title.externalRating.toFixed(1)
                  : "—"
              }
              suffix={title.externalRating != null ? "/10" : ""}
              note={
                title.externalRatingCount != null
                  ? `${title.externalRatingCount.toLocaleString("tr-TR")} oy`
                  : undefined
              }
            />
          </div>

          {/* Platformlar + aksiyonlar */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {primaryProviders.map((provider) => {
              const meta = MONETIZATION_LABELS[provider.monetizationType];
              return (
                <a
                  key={`${provider.providerId}-${provider.monetizationType}`}
                  href={provider.link ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`${provider.name} - ${meta.label}`}
                  className="group flex items-center gap-1.5 rounded-lg border border-ink-600 bg-ink-800/80 py-1 pl-1 pr-2 transition-colors hover:border-gold-500/50"
                >
                  {provider.logoPath ? (
                    <Image
                      src={`https://image.tmdb.org/t/p/w92${provider.logoPath}`}
                      alt=""
                      width={20}
                      height={20}
                      className="h-5 w-5 rounded object-contain"
                      unoptimized
                    />
                  ) : (
                    <span className="grid h-5 w-5 place-items-center text-[0.6rem] text-mist-400">
                      {provider.name.slice(0, 1)}
                    </span>
                  )}
                  <span className="text-[0.7rem] text-mist-300 group-hover:text-mist-100">
                    {provider.name}
                  </span>
                  <span className="text-[0.62rem] text-mist-500">
                    {meta.short}
                  </span>
                </a>
              );
            })}
            {extraProviders > 0 && (
              <span
                className="rounded-lg border border-ink-700 bg-ink-800/60 px-2 py-1 text-[0.7rem] text-mist-400"
                title={sortedProviders
                  .slice(5)
                  .map((p) => `${p.name} (${MONETIZATION_LABELS[p.monetizationType].short})`)
                  .join(", ")}
              >
                +{extraProviders} platform
              </span>
            )}

            <span className="mx-1 hidden h-6 w-px bg-ink-700 sm:block" />

            <AddToListButton
              titleId={title.id}
              userId={userId}
            />
          </div>

          {/* Kaynak linkleri */}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.68rem] text-mist-500">
            {title.metadataProvider && (
              <span>
                Kaynak:{" "}
                <span className="text-mist-300">{title.metadataProvider}</span>
              </span>
            )}
            {title.imdbId && <span>IMDb: {title.imdbId}</span>}
            {title.wikidataId && (
              <a
                href={`https://www.wikidata.org/wiki/${title.wikidataId}`}
                target="_blank"
                rel="noreferrer noopener"
                className="text-gold-400 hover:underline"
              >
                Wikidata
              </a>
            )}
            {title.homepageUrl && (
              <a
                href={title.homepageUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-gold-400 hover:underline"
              >
                Resmî site ↗
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function StatBlock({
  label,
  value,
  suffix = "",
  note,
  highlight = false,
}: {
  label: string;
  value: string;
  suffix?: string;
  note?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-2.5 py-2 ${
        highlight
          ? "border-gold-500/40 bg-gold-500/10"
          : "border-ink-700 bg-ink-850/70"
      }`}
    >
      <p className="truncate text-[0.6rem] uppercase tracking-wide text-mist-500">
        {label}
      </p>
      <p
        className={`font-display text-lg font-bold leading-tight ${
          highlight ? "text-gold-300" : "text-mist-100"
        }`}
      >
        {value}
        <span className="text-xs font-normal text-mist-500">{suffix}</span>
      </p>
      {note && <p className="truncate text-[0.6rem] text-mist-500">{note}</p>}
    </div>
  );
}
