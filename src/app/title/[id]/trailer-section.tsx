/** Wikipedia makalesinden derlenen fragmani YouTube/NYT-style embed ile gosterir. */
export default function TrailerSection({ trailerUrl }: { trailerUrl: string }) {
  const m = trailerUrl.match(/v=([\w-]{6,})/) ?? trailerUrl.match(/youtu\.be\/([\w-]{6,})/);
  const id = m?.[1] ?? null;
  if (!id) return null;

  return (
    <section className="rounded-xl">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg text-mist-100">Fragman</h2>
        <a
          href={trailerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gold-400 hover:underline"
        >
          YouTube&apos;da aç ↗
        </a>
      </div>
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
    </section>
  );
}
