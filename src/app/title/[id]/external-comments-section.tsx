import { DetailCard } from "@/components/catalog/detail-card";
import { ExternalCommentItem } from "@/components/community/external-comment-item";
import type { ExternalComment } from "@/lib/community/external-comments";

/**
 * Wikipedia makalelerinden derlenen (CC BY-SA, kaynaklia) yorumlar.
 * Yerli (TR) ve yabanci (EN) olarak iki gruba ayrilir; yabanci olanlar
 * tek tikla Turkceye cevrilebilir (bulut AI; ceviri DB'de saklanir).
 */
export default function ExternalCommentsSection({
  local,
  foreign,
  total,
  translationEnabled,
  className = "",
}: {
  local: ExternalComment[];
  foreign: ExternalComment[];
  total: number;
  translationEnabled: boolean;
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
                <ExternalCommentItem
                  key={item.id}
                  item={item}
                  translationEnabled={translationEnabled}
                />
              ))}
            </ul>
          </div>
        ) : null}

        {foreign.length > 0 ? (
          <div>
            <h3 className="mb-1 flex flex-wrap items-center gap-2 text-sm font-medium text-gold-300">
              Yabancı yorumlar{" "}
              <span className="text-mist-500">({foreign.length})</span>
              {translationEnabled ? (
                <span className="text-[0.68rem] font-normal text-mist-500">
                  çeviri: AI (taslak)
                </span>
              ) : null}
            </h3>
            <ul>
              {foreign.map((item) => (
                <ExternalCommentItem
                  key={item.id}
                  item={item}
                  translationEnabled={translationEnabled}
                />
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </DetailCard>
  );
}
