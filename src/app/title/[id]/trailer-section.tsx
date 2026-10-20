/** Fragmani YouTube/NYT-style embed ile gosterir (baslik disarida tutulur). */
export default function TrailerSection({
  trailerUrl,
  showLink = true,
}: {
  trailerUrl: string;
  showLink?: boolean;
}) {
  const m = trailerUrl.match(/v=([\w-]{6,})/) ?? trailerUrl.match(/youtu\.be\/([\w-]{6,})/);
  const id = m?.[1] ?? null;
  if (!id) return null;

  return (
    <div>
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-ink-700 bg-ink-900">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?rel=0`}
          title="Fragman"
          loading="lazy"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      </div>
      {showLink ? (
        <a
          href={trailerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs text-gold-400 hover:underline"
        >
          YouTube&apos;da aç ↗
        </a>
      ) : null}
    </div>
  );
}
