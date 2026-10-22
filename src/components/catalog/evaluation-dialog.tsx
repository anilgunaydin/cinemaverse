"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import {
  EvaluationCard,
  type EvaluationEntry,
  type EvaluationReview,
  type EvaluationViewer,
} from "./evaluation-card";

/**
 * Hero'daki "Sizin puanınız" alanından açılan tam değerlendirme penceresi.
 * Kişisel hafıza (not, detaylar, favori), herkese açık inceleme ve topluluk
 * incelemeleri tek yerde tutar; sayfada ayrıca büyük bir kart kaplamaz.
 */
export function EvaluationDialog({
  open,
  onClose,
  titleId,
  titleName,
  isSeries,
  entry,
  viewer,
  initialReviews,
}: {
  open: boolean;
  onClose: () => void;
  titleId: string;
  titleName: string;
  isSeries: boolean;
  entry: EvaluationEntry;
  viewer: EvaluationViewer;
  initialReviews: EvaluationReview[];
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = setTimeout(() => panelRef.current?.focus(), 0);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      clearTimeout(timer);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-ink-950/85 p-3 backdrop-blur-sm sm:items-center sm:p-6"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Değerlendirmen"
        tabIndex={-1}
        className="w-full max-w-5xl outline-none"
      >
        <EvaluationCard
          titleId={titleId}
          titleName={titleName}
          isSeries={isSeries}
          entry={entry}
          viewer={viewer}
          initialReviews={initialReviews}
          onClose={onClose}
          className="max-h-[calc(100dvh-24px)] rounded-2xl border-ink-600 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] sm:max-h-[calc(100dvh-48px)]"
        />
      </div>
    </div>,
    document.body,
  );
}
