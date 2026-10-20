import type { ExternalComment } from "@/lib/community/external-comments";

function Chip({ item }: { item: ExternalComment }) {
  const sourceLabel = item.source === "wikipedia-tr" ? "Wikipedia (TR)" : "Wikipedia (EN)";
  return (
    <li
      id={`ext-${item.id}`}
      className="border-b border-ink-700 py-3 last:border-b-0"
    >
      <p className="text-sm leading-relaxed text-mist-200">{item.body}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-mist-500">
        <span className="rounded-full border border-ink-600 px-2 py-0.5">
          {sourceLabel}
        </span>
        {item.section ? <span>{item.section}</span> : null}
        {item.sourceUrl ? (
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold-400 hover:underline"
          >
            kaynak ↗
          </a>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Wikipedia makalelerinden derlenen (CC BY-SA, kaynaklia) yorumlar.
 * Yerli (TR) ve yabanci (EN) olarak iki grubun ayirilir.
 */
export default function ExternalCommentsSection({
  local,
  foreign,
  total,
}: {
  local: ExternalComment[];
  foreign: ExternalComment[];
  total: number;
}) {
  if (total === 0) return null;
  const shown = local.length + foreign.length;

  return (
    <section className="surface rounded-xl p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg text-mist-100">
          İnternet Yorumları
        </h2>
        <p className="text-xs text-mist-500">
          Wikipedia makalelerinden derlendi (CC BY-SA) — kullanıcı incelemelerinden
          ayrıdır.
          {shown < total ? `${shown}/${total} gösteriliyor.` : ""}
        </p>
      </div>

      {/* Uzun listeler sayfayi domine etmesin - kart ici kaydirilir */}
      <div className="max-h-[420px] space-y-4 overflow-y-auto pr-1">
        {local.length > 0 ? (
          <div>
            <h3 className="mb-1 text-sm font-medium text-gold-300">
              Yerli yorumlar <span className="text-mist-500">({local.length})</span>
            </h3>
            <ul>
              {local.map((item) => (
                <Chip key={item.id} item={item} />
              ))}
            </ul>
          </div>
        ) : null}

        {foreign.length > 0 ? (
          <div>
            <h3 className="mb-1 text-sm font-medium text-gold-300">
              Yabancı yorumlar <span className="text-mist-500">({foreign.length})</span>
            </h3>
            <ul>
              {foreign.map((item) => (
                <Chip key={item.id} item={item} />
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
