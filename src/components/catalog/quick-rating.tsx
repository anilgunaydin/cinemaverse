"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";

import {
  EvaluationDialog,
} from "@/components/catalog/evaluation-dialog";
import type {
  EvaluationEntry,
  EvaluationReview,
  EvaluationViewer,
} from "@/components/catalog/evaluation-card";

type Status =
  | "watched"
  | "watching"
  | "watchlist"
  | "dropped"
  | "not_watched"
  | "unsure";

const STATUS_LABELS: { value: Status; label: string }[] = [
  { value: "watched", label: "İzledim" },
  { value: "watching", label: "İzliyorum" },
  { value: "watchlist", label: "Listemde" },
  { value: "dropped", label: "Yarım" },
  { value: "not_watched", label: "İzlemedim" },
  { value: "unsure", label: "Emin değilim" },
];

/**
 * Hero'daki "Sizin puanınız" kutusu.
 * Uzerine gelince (veya dokununca) kucuk bir "Degerlendirmen" penceresi acilir:
 * durum + puan + kaydet. "Not ve inceleme ekle" tam degerlendirme penceresini
 * acar (notlar, detaylar, herkese acik inceleme, topluluk incelemeleri).
 *
 * Pencere portal ile body'ye tasinir; cunku hero `overflow-hidden` ve pencere
 * hero'nun disina tasabiliyor.
 */
export function QuickRating({
  titleId,
  titleName,
  isSeries,
  userId,
  isLoggedIn,
  initialStatus,
  initialRating,
  entry,
  initialReviews,
}: {
  titleId: string;
  titleName: string;
  isSeries: boolean;
  userId: string | null;
  isLoggedIn: boolean;
  initialStatus: Status | null;
  initialRating: number | null;
  entry: EvaluationEntry;
  initialReviews: EvaluationReview[];
}) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinnedRef = useRef(false);

  const [open, setOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [rect, setRect] = useState<{ left: number; top: number; bottom: number } | null>(
    null,
  );
  const [status, setStatus] = useState<Status>(initialStatus ?? "watched");
  const [rating, setRating] = useState<number | null>(initialRating);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sunucu degerleri baska bir yerden (ör. tam degerlendirme karti)
  // degisirse state'i esitle; kendi kaydimizda degerler zaten ayni oldugu
  // icin pencere kapanmaz.
  const serverSnapshot = useRef({
    status: initialStatus ?? ("watched" as Status),
    rating: initialRating,
  });

  useEffect(() => {
    if (serverSnapshot.current.status !== (initialStatus ?? "watched")) {
      serverSnapshot.current.status = initialStatus ?? "watched";
      setStatus(initialStatus ?? "watched");
    }
    if (serverSnapshot.current.rating !== initialRating) {
      serverSnapshot.current.rating = initialRating;
      setRating(initialRating);
    }
  }, [initialStatus, initialRating]);

  useEffect(() => {
    const closeRef = closeTimer;
    return () => {
      if (closeRef.current) clearTimeout(closeRef.current);
    };
  }, []);

  const place = useCallback(() => {
    const element = triggerRef.current;
    if (!element) return;
    const box = element.getBoundingClientRect();
    setRect({ left: box.left, top: box.top, bottom: box.bottom });
  }, []);

  const show = useCallback(() => {
    place();
    setOpen(true);
  }, [place]);

  const hide = useCallback(() => {
    // Kullanici pencereye tiklayip "sabitlediyse" fare ayrilinca kapanmaz.
    if (pinnedRef.current) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 220);
  }, []);

  const close = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    pinnedRef.current = false;
    setOpen(false);
  }, []);

  const pin = useCallback(() => {
    pinnedRef.current = true;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    place();
    setOpen(true);
  }, [place]);

  const cancelHide = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  // Konum: kaydirma/yeniden boyutlandirmada pencereyi takip et
  useEffect(() => {
    if (!open) return;
    const follow = () => place();
    window.addEventListener("scroll", follow, { passive: true, capture: true });
    window.addEventListener("resize", follow);
    return () => {
      window.removeEventListener("scroll", follow, { capture: true });
      window.removeEventListener("resize", follow);
    };
  }, [open, place]);

  // Escape ve disari tiklama
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      close();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open, close]);

  const save = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleId, status, rating }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Kaydedilemedi.");
      // Kaydettigimiz degerleri "sunucu gercegi" olarak isaretle: bu sirada
      // devam eden router.refresh() eski degeri getirse bile kullanicinin
      // yeni secimini ezmesin.
      serverSnapshot.current = { status, rating };
      setMessage("Kaydedildi.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const openDetails = () => {
    close();
    setDetailsOpen(true);
  };

  const viewer: EvaluationViewer = {
    userId: userId ?? "",
    status: initialStatus,
    season: entry?.progressSeason ?? null,
    episode: entry?.progressEpisode ?? null,
  };

  const highlight = rating != null;
  const popoverWidth = Math.min(340, typeof window === "undefined" ? 340 : window.innerWidth - 24);
  const placeAbove = rect ? rect.bottom + 300 > (typeof window === "undefined" ? 900 : window.innerHeight) : false;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Puanını hızlıca değerlendir"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onClick={pin}
        className={`w-full rounded-xl border px-2.5 py-1.5 text-left backdrop-blur-sm transition-colors ${
          highlight
            ? "border-gold-500/40 bg-gold-500/10 hover:border-gold-500/60"
            : "border-ink-700/80 bg-ink-950/40 hover:border-ink-500"
        }`}
      >
        <p className="truncate text-[0.58rem] uppercase tracking-[0.08em] text-mist-500">
          Sizin puanınız
        </p>
        <p
          className={`font-display text-xl font-bold leading-tight ${
            highlight ? "text-gold-300" : "text-mist-100"
          }`}
        >
          {rating != null ? rating : "—"}
          <span className="ml-0.5 text-[0.65rem] font-normal text-mist-500">
            {rating != null ? "/10" : ""}
          </span>
        </p>
        <p className="truncate text-[0.6rem] text-mist-500">
          {isLoggedIn ? "puanla · not ekle" : "giriş yap"}
        </p>
      </button>

      {open && rect
        ? createPortal(
            <div
              ref={popoverRef}
              role="dialog"
              aria-label="Hızlı değerlendirme"
              onMouseEnter={cancelHide}
              onMouseLeave={hide}
              onPointerDown={pin}
              style={{
                position: "fixed",
                left: Math.max(12, Math.min(rect.left, window.innerWidth - popoverWidth - 12)),
                top: placeAbove ? undefined : rect.bottom + 8,
                bottom: placeAbove ? window.innerHeight - rect.top + 8 : undefined,
                width: popoverWidth,
              }}
              className="z-[70] rounded-xl border border-gold-500/30 bg-ink-950/97 p-3 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.85)] backdrop-blur"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-[0.9rem] font-semibold text-mist-100">
                  Değerlendirmen
                </h3>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Kapat"
                  className="grid h-6 w-6 place-items-center rounded-md text-mist-500 hover:bg-ink-800 hover:text-mist-200"
                >
                  ✕
                </button>
              </div>

              {!isLoggedIn ? (
                <div className="mt-2">
                  <p className="text-[0.76rem] leading-relaxed text-mist-300">
                    Puan vermek ve hafızana eklemek için giriş yap.
                  </p>
                  <Link href="/login" className="btn btn-primary mt-2 text-xs">
                    Giriş yap
                  </Link>
                </div>
              ) : (
                <>
                  <div className="mt-2">
                    <span className="label">İzleme durumu</span>
                    <div className="grid grid-cols-3 gap-1">
                      {STATUS_LABELS.map((entry) => (
                        <button
                          key={entry.value}
                          type="button"
                          onClick={() => setStatus(entry.value)}
                          aria-pressed={status === entry.value}
                          className={`rounded-md border px-1 py-1 text-[0.66rem] font-medium transition-colors ${
                            status === entry.value
                              ? "border-gold-500/50 bg-gold-500/15 text-gold-300"
                              : "border-ink-600 bg-ink-900 text-mist-400 hover:border-ink-500"
                          }`}
                        >
                          {entry.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-2">
                    <div className="flex items-baseline justify-between">
                      <span className="label mb-0">Puanın</span>
                      <span
                        className={`text-[0.68rem] font-semibold ${
                          rating ? "text-gold-300" : "text-mist-500"
                        }`}
                      >
                        {rating ? `${rating}/10` : "verilmedi"}
                      </span>
                    </div>
                    <div className="mt-1 grid grid-cols-10 gap-0.5">
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => (
                        <button
                          key={value}
                          type="button"
                          aria-label={`${value} puan`}
                          aria-pressed={rating === value}
                          onClick={() => setRating(rating === value ? null : value)}
                          className={`h-6 rounded-md border text-[0.64rem] font-semibold transition-colors ${
                            rating !== null && value <= rating
                              ? "border-gold-500/60 bg-gold-500/25 text-gold-200"
                              : "border-ink-600 bg-ink-900 text-mist-500 hover:border-ink-500"
                          }`}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={save}
                      disabled={saving}
                      className="btn btn-primary text-xs"
                    >
                      {saving ? "Kaydediliyor…" : "Kaydet"}
                    </button>
                    <button
                      type="button"
                      onClick={openDetails}
                      className="text-[0.7rem] text-gold-400 hover:text-gold-300"
                    >
                      Detaylı değerlendirme →
                    </button>
                  </div>

                  {message ? (
                    <p role="status" className="mt-2 text-[0.7rem] text-jade-400">
                      {message}
                    </p>
                  ) : null}
                  {error ? (
                    <p role="alert" className="mt-2 text-[0.7rem] text-rose-400">
                      {error}
                    </p>
                  ) : null}
                </>
              )}
            </div>,
            document.body,
          )
        : null}

      <EvaluationDialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        titleId={titleId}
        titleName={titleName}
        isSeries={isSeries}
        entry={entry}
        viewer={viewer}
        initialReviews={initialReviews}
      />
    </>
  );
}
