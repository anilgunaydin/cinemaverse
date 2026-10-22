"use client";

import { useState } from "react";

/**
 * Internet yorumu (Wikipedia alintisi).
 * Yabanci yorumlar icin "Turkceye cevir" dugmesi; ceviri AI ile uretilir,
 * DB'de saklanir ve kaynak metnin ALTINDA gosterilir. Kaynak metin degismez.
 */

export type ExternalCommentView = {
  id: string;
  source: string;
  sourceUrl: string | null;
  section: string | null;
  language: "tr" | "en" | "other";
  body: string;
  translationTr: string | null;
};

const SOURCE_LABELS: Record<string, string> = {
  "wikipedia-tr": "Wikipedia (TR)",
  "wikipedia-en": "Wikipedia (EN)",
};

export function ExternalCommentItem({
  item,
  translationEnabled,
}: {
  item: ExternalCommentView;
  translationEnabled: boolean;
}) {
  const [translation, setTranslation] = useState<string | null>(
    item.translationTr,
  );
  // Daha once cevrilmis yorumlar sayfa yenilendiginde acik gelir.
  const [showTranslation, setShowTranslation] = useState(
    Boolean(item.translationTr),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canTranslate = item.language !== "tr";
  const sourceLabel = SOURCE_LABELS[item.source] ?? "İnternet";

  const handleTranslate = async () => {
    if (translation) {
      setShowTranslation((value) => !value);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/external-comments/${encodeURIComponent(item.id)}/translate`,
        { method: "POST" },
      );
      const data = (await response.json()) as {
        translation?: string;
        error?: string;
      };
      if (!response.ok || !data.translation) {
        throw new Error(data.error ?? "Çeviri yapılamadı.");
      }
      setTranslation(data.translation);
      setShowTranslation(true);
    } catch (translationError) {
      setError(
        translationError instanceof Error
          ? translationError.message
          : "Çeviri yapılamadı.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <li
      id={`ext-${item.id}`}
      className="border-b border-ink-700/70 py-2.5 last:border-b-0"
    >
      <p className="text-sm leading-relaxed text-mist-200">{item.body}</p>

      {translation && showTranslation ? (
        <div className="mt-2 rounded-lg border border-gold-500/20 bg-gold-500/5 px-2.5 py-2">
          <p className="mb-1 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.07em] text-mist-500">
            <span className="rounded-full border border-gold-500/30 bg-gold-500/10 px-1.5 py-0.5 font-semibold text-gold-300">
              Türkçe çeviri
            </span>
            <span className="normal-case tracking-normal">
              taslak · AI
            </span>
          </p>
          <p className="text-sm leading-relaxed text-mist-200">{translation}</p>
        </div>
      ) : null}

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

        {canTranslate ? (
          <button
            type="button"
            onClick={handleTranslate}
            disabled={loading || !translationEnabled}
            aria-expanded={translation ? showTranslation : undefined}
            title={
              translationEnabled
                ? undefined
                : "Çeviri için yapay zekâ sağlayıcısı kapalı"
            }
            className="rounded-full border border-ink-600 px-2 py-0.5 text-[11px] font-medium text-mist-300 transition-colors hover:border-gold-500/40 hover:text-gold-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Çevriliyor…"
              : translation
                ? showTranslation
                  ? "Çeviriyi gizle"
                  : "Çeviriyi göster"
                : "Türkçeye çevir"}
          </button>
        ) : null}

        {error ? <span className="text-rose-400">{error}</span> : null}
      </div>
    </li>
  );
}
