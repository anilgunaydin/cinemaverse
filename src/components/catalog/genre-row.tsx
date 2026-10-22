"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { PosterCard } from "@/components/catalog/poster-card";

export type GenreRowItem = {
  id: string;
  title: string;
  subtitle: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  trailerUrl: string | null;
  rating: number | null;
};

/**
 * Tek bir tur satiri: saga dogru kayan (scroll-snap) kart seridi + ok dugmeleri.
 * Ok dugmeleri ucta devre disi kalir; kaydirma klavye ve dokunmayla da calisir.
 */
export function GenreRow({
  name,
  slug,
  items,
}: {
  name: string;
  slug?: string | null;
  items: GenreRowItem[];
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateEdges = useCallback(() => {
    const element = scrollerRef.current;
    if (!element) return;
    setCanLeft(element.scrollLeft > 4);
    setCanRight(
      element.scrollLeft + element.clientWidth < element.scrollWidth - 4,
    );
  }, []);

  useEffect(() => {
    const element = scrollerRef.current;
    if (!element) return;
    updateEdges();
    element.addEventListener("scroll", updateEdges, { passive: true });
    const observer = new ResizeObserver(updateEdges);
    observer.observe(element);
    return () => {
      element.removeEventListener("scroll", updateEdges);
      observer.disconnect();
    };
  }, [updateEdges, items.length]);

  const scrollByPage = (direction: 1 | -1) => {
    const element = scrollerRef.current;
    if (!element) return;
    // Bilincli olarak anlik kaydirma: CSS smooth bazi ortamlarda (arka plan
    // sekmesi, otomasyon) hic ilerlemiyor; snap noktalari zaten yumusak
    // hissi veriyor.
    element.scrollLeft += direction * element.clientWidth * 0.85;
  };

  return (
    <section
      id={slug ? `tur-${slug}` : undefined}
      className="mt-6 scroll-mt-24"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-baseline gap-1.5 font-display text-base font-semibold text-mist-100">
          <span className="truncate">{name}</span>
          <span className="shrink-0 text-[0.7rem] font-normal text-mist-500">
            {items.length}
          </span>
        </h3>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => scrollByPage(-1)}
            disabled={!canLeft}
            aria-label={`${name} satırını sola kaydır`}
            className="grid h-7 w-7 place-items-center rounded-lg border border-ink-600 bg-ink-900 text-mist-300 transition-colors hover:border-gold-500/40 hover:text-gold-300 disabled:cursor-default disabled:opacity-30"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => scrollByPage(1)}
            disabled={!canRight}
            aria-label={`${name} satırını sağa kaydır`}
            className="grid h-7 w-7 place-items-center rounded-lg border border-ink-600 bg-ink-900 text-mist-300 transition-colors hover:border-gold-500/40 hover:text-gold-300 disabled:cursor-default disabled:opacity-30"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        role="region"
        aria-label={`${name} yapımları`}
        tabIndex={0}
        className="row-scroll flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 outline-none focus-visible:ring-1 focus-visible:ring-gold-500/40"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className="w-[168px] shrink-0 snap-start sm:w-[204px]"
          >
            <PosterCard
              href={`/title/${item.id}`}
              title={item.title}
              subtitle={item.subtitle}
              posterUrl={item.posterUrl}
              backdropUrl={item.backdropUrl}
              trailerUrl={item.trailerUrl}
              rating={item.rating}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
