import Image from "next/image";
import Link from "next/link";

import HoverTrailer from "./hover-trailer";

/**
 * Netflix-stili yatay (16:9) yapim karti:
 * - Gorsel tercihi backdropUrl (yatay sahne), yoksa poster (cover kirpma).
 * - hover'da trailer yuzen onizleme paneli (HoverTrailer) acilir.
 */
export function PosterCard({
  href,
  title,
  subtitle,
  backdropUrl,
  posterUrl,
  trailerUrl,
  badge,
  rating,
}: {
  href: string;
  title: string;
  subtitle?: string | null;
  backdropUrl?: string | null;
  posterUrl?: string | null;
  trailerUrl?: string | null;
  badge?: string | null;
  rating?: number | null;
}) {
  const imageUrl = backdropUrl ?? posterUrl ?? null;

  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-xl border border-ink-700 bg-ink-850 transition-all hover:-translate-y-0.5 hover:border-gold-500/40 hover:shadow-[0_10px_30px_-14px_rgba(212,169,79,0.35)]"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-ink-800">
        {trailerUrl ? (
          <HoverTrailer
            trailerUrl={trailerUrl}
            linkHref={href}
            metaTitle={title}
            metaSubtitle={subtitle}
            metaRating={rating}
          />
        ) : null}
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={`${title} görseli`}
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 260px"
            className={`object-cover transition-transform duration-300 group-hover:scale-[1.03] ${
              backdropUrl ? "" : backdropUrl === null ? "object-[center_25%]" : ""
            }`}
            unoptimized
          />
        ) : (
          <div className="grid h-full w-full place-items-center px-2 text-center text-[0.65rem] leading-tight text-mist-500">
            Görsel
            <br />
            bulunmuyor
          </div>
        )}

        {badge ? (
          <span className="absolute left-1.5 top-1.5 z-20 rounded-md bg-ink-950/85 px-1.5 py-0.5 text-[0.62rem] font-semibold text-gold-300 backdrop-blur">
            {badge}
          </span>
        ) : null}

        {typeof rating === "number" ? (
          <span className="absolute right-1.5 top-1.5 z-20 rounded-md bg-gold-500/90 px-1.5 py-0.5 text-[0.62rem] font-bold text-ink-950">
            {rating.toFixed(1)}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-0.5 p-2.5">
        <p className="line-clamp-2 text-[0.82rem] font-medium leading-snug text-mist-100">
          {title}
        </p>
        {subtitle ? (
          <p className="text-[0.68rem] text-mist-500">{subtitle}</p>
        ) : null}
      </div>
    </Link>
  );
}
