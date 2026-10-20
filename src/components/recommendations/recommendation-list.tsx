"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Reason = { factor: string; contribution: number; detail: string };

type RecommendationItem = {
  id: string;
  titleId: string;
  kind: "safe" | "discovery" | "rewatch";
  score: number;
  confidence: number;
  uncertaintyNote: string | null;
  reasons: Reason[];
  title: {
    originalTitle: string;
    localizedTitle: string | null;
    releaseYear: number | null;
    posterUrl: string | null;
    kind: string;
    externalRating: number | null;
  };
  genres: string[];
};

export function RecommendationList({
  items,
  emptyMessage,
}: {
  items: RecommendationItem[];
  emptyMessage: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);

  async function sendFeedback(titleId: string, verdict: string) {
    setPending(titleId);
    setMessage(null);
    try {
      const response = await fetch("/api/recommendations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleId, verdict }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setMessage(data.error ?? "Geri bildirim kaydedilemedi.");
        return;
      }
      if (verdict === "not_interested") {
        setHidden((current) => new Set(current).add(titleId));
        setMessage("Bu öneri listeden çıkarıldı.");
      } else {
        setMessage(
          verdict === "saved"
            ? "Kaydedildi."
            : verdict === "watched"
              ? "İzledim olarak işaretlendi."
              : "Geri bildiriminiz kaydedildi.",
        );
        router.refresh();
      }
    } catch {
      setMessage("Sunucuya ulaşılamadı.");
    } finally {
      setPending(null);
    }
  }

  const visible = items.filter((item) => !hidden.has(item.titleId));

  if (visible.length === 0) {
    return (
      <div className="surface-flat px-5 py-8 text-center">
        <p className="text-sm text-mist-300">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {message ? (
        <p
          role="status"
          className="rounded-lg border border-jade-500/40 bg-jade-500/10 px-3 py-2 text-xs text-jade-400"
        >
          {message}
        </p>
      ) : null}

      <ul className="flex flex-col gap-2.5">
        {visible.map((item) => {
          const displayTitle = item.title.localizedTitle ?? item.title.originalTitle;
          return (
            <li key={item.id} className="surface-flat flex gap-3 p-3">
              <Link
                href={`/title/${item.titleId}`}
                className="relative h-28 w-19 shrink-0 overflow-hidden rounded-md bg-ink-800"
                style={{ width: "76px" }}
              >
                {item.title.posterUrl ? (
                  <Image
                    src={item.title.posterUrl}
                    alt={`${displayTitle} posteri`}
                    fill
                    sizes="76px"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <span className="grid h-full place-items-center px-1 text-center text-[0.6rem] text-mist-500">
                    Poster yok
                  </span>
                )}
              </Link>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Link
                    href={`/title/${item.titleId}`}
                    className="font-medium text-mist-100 hover:text-gold-300"
                  >
                    {displayTitle}
                  </Link>
                  {item.title.releaseYear ? (
                    <span className="chip">{item.title.releaseYear}</span>
                  ) : null}
                  <span className="chip">
                    {item.title.kind === "series" ? "Dizi" : "Film"}
                  </span>
                  <span className={`chip ${item.kind === "safe" ? "chip-jade" : "chip-gold"}`}>
                    {item.kind === "safe" ? "Güvenli öneri" : "Keşif önerisi"}
                  </span>
                  <span className="chip" title="Profil uyum skoru">
                    skor {item.score.toFixed(2)}
                  </span>
                  <span className="chip" title="Kanıt miktarına bağlı güven">
                    güven %{Math.round(item.confidence * 100)}
                  </span>
                </div>

                {item.genres.length > 0 ? (
                  <p className="mt-1 text-[0.7rem] text-mist-500">
                    {item.genres.join(" · ")}
                  </p>
                ) : null}

                <ul className="mt-1.5 flex flex-col gap-0.5">
                  {item.reasons.slice(0, 3).map((reason, index) => (
                    <li
                      key={`${reason.factor}-${index}`}
                      className="flex items-start gap-1.5 text-[0.76rem] leading-snug text-mist-400"
                    >
                      <span
                        className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                          reason.contribution >= 0 ? "bg-jade-500" : "bg-rose-500"
                        }`}
                        aria-hidden="true"
                      />
                      <span>{reason.detail}</span>
                    </li>
                  ))}
                </ul>

                {item.uncertaintyNote ? (
                  <p className="mt-1.5 text-[0.7rem] italic text-mist-500">
                    {item.uncertaintyNote}
                  </p>
                ) : null}

                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => sendFeedback(item.titleId, "saved")}
                    disabled={pending === item.titleId}
                    className="btn btn-ghost px-2.5 py-1 text-[0.72rem]"
                  >
                    İzleme listeme ekle
                  </button>
                  <button
                    type="button"
                    onClick={() => sendFeedback(item.titleId, "liked")}
                    disabled={pending === item.titleId}
                    className="btn btn-ghost px-2.5 py-1 text-[0.72rem]"
                  >
                    İlgi çekici
                  </button>
                  <button
                    type="button"
                    onClick={() => sendFeedback(item.titleId, "not_interested")}
                    disabled={pending === item.titleId}
                    className="btn btn-ghost px-2.5 py-1 text-[0.72rem]"
                  >
                    İlgilenmiyorum
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
