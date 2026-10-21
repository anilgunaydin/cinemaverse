import { DetailCard } from "@/components/catalog/detail-card";
import type { ExternalComment } from "@/lib/community/external-comments";

function CommentItem({ item }: { item: ExternalComment }) {
  const sourceLabel =
    item.source === "wikipedia-tr" ? "Wikipedia (TR)" : "Wikipedia (EN)";
  return (
    <li
      id={`ext-${item.id}`}
      className="border-b border-ink-700/70 py-2.5 last:border-b-0"
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
 * Yerli (TR) ve yabanci (EN) olarak iki gruba ayrilir.
 */
export default function ExternalCommentsSection({
  local,
  foreign,
  total,
  className = "",
}: {
  local: ExternalComment[];
  foreign: ExternalComment[];
  total: number;
  className?: string;
}) {
  if (total === 0) return null;
  const shown = local.length + foreign.length;

  return (
    <DetailCard
      icon="quote"
      title="İnternet Yorumları"
      meta={`${total} alıntı`}
      className={className}
      bodyClassName="p-0"
    >
      <p className="shrink-0 border-b border-ink-700/60 px-4 py-2 text-[0.68rem] leading-relaxed text-mist-500">
        Wikipedia makalelerinden derlendi (CC BY-SA) — kullanıcı incelemelerinden
        ayrıdır.
        {shown < total ? ` ${shown}/${total} gösteriliyor.` : ""}
      </p>

      {/* Uzun listeler sayfayi domine etmesin — kart ici kaydirilir */}
      <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-4 py-3 max-lg:max-h-[420px]">
        {local.length > 0 ? (
          <div>
            <h3 className="mb-1 text-sm font-medium text-gold-300">
              Yerli yorumlar{" "}
              <span className="text-mist-500">({local.length})</span>
            </h3>
            <ul>
              {local.map((item) => (
                <CommentItem key={item.id} item={item} />
              ))}
            </ul>
          </div>
        ) : null}

        {foreign.length > 0 ? (
          <div>
            <h3 className="mb-1 text-sm font-medium text-gold-300">
              Yabancı yorumlar{" "}
              <span className="text-mist-500">({foreign.length})</span>
            </h3>
            <ul>
              {foreign.map((item) => (
                <CommentItem key={item.id} item={item} />
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </DetailCard>
  );
}
