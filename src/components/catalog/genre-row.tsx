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
  kind: "movie" | "series";
};

/**
 * Tek bir tur satiri: saga dogru kayan (scroll-snap) kart seridi.
 * Kaydirma cubugu gizlidir; satir ustune gelince kenarlarda beliren yuvarlak
 * oklar ve kenar solmalari "devami var" hissini verir. Klavye ve dokunmayla
 * da kaydirilabilir.
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
  const animationRef = useRef<number | null>(null);
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

    const maxScroll = element.scrollWidth - element.clientWidth;
    const start = element.scrollLeft;
    const naturalTarget = Math.max(
      0,
      Math.min(
        maxScroll,
        element.scrollLeft + direction * element.clientWidth * 0.85,
      ),
    );

    // Bir sonraki karta hizala: animasyon bitince snap geri acildiginda
    // kucuk bir sicrama olmasin.
    const scrollerRect = element.getBoundingClientRect();
    const snapTargets = [
      0,
      ...[...element.children].map((child) => {
        const rect = child.getBoundingClientRect();
        return rect.left - scrollerRect.left + element.scrollLeft;
      }),
    ];
    const snapped =
      snapTargets.length > 0
        ? Math.max(
            0,
            Math.min(
              maxScroll,
              snapTargets.reduce((best, value) =>
                Math.abs(value - naturalTarget) < Math.abs(best - naturalTarget)
                  ? value
                  : best,
              ),
            ),
          )
        : naturalTarget;
    // Snap noktasi geride kaldiysa ters yone kacmasin.
    const target =
      direction === -1 ? Math.min(snapped, start) : Math.max(snapped, start);
    const distance = target - start;
    if (Math.abs(distance) < 2) return;

    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    // Hareket azaltma tercihine saygi: anlik gecis.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      element.scrollLeft = target;
      return;
    }

    // yumusak, ivmeli kaydirma (CSS smooth bazi ortamlarda calismiyor).
    // Animasyon sirasinda snap'i kapatip sonunda geri aciyoruz; aksi halde
    // tarayici her adimda kart sinirina geri cekiyor.
    const duration = Math.min(720, 420 + Math.abs(distance) * 0.22);
    const startedAt = performance.now();
    element.style.scrollSnapType = "none";

    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased =
        progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      element.scrollLeft = start + distance * eased;

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(step);
      } else {
        animationRef.current = null;
        // CSS sinifindaki snap-mandatory'yi geri ver.
        element.style.scrollSnapType = "";
      }
    };

    animationRef.current = requestAnimationFrame(step);
  };

  // Kullanici tekerlekle/dokunarak mudahale ederse animasyonu durdur.
  useEffect(() => {
    const element = scrollerRef.current;
    if (!element) return;
    const cancel = () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      element.style.scrollSnapType = "";
    };
    element.addEventListener("wheel", cancel, { passive: true });
    element.addEventListener("touchstart", cancel, { passive: true });
    element.addEventListener("pointerdown", cancel);
    return () => {
      element.removeEventListener("wheel", cancel);
      element.removeEventListener("touchstart", cancel);
      element.removeEventListener("pointerdown", cancel);
    };
  }, []);

  useEffect(
    () => () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    },
    [],
  );

  return (
    <section
      id={slug ? `tur-${slug}` : undefined}
      className="group/row mt-6 scroll-mt-24"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-baseline gap-1.5 font-display text-base font-semibold text-mist-100">
          <span className="truncate">{name}</span>
          <span className="shrink-0 text-[0.7rem] font-normal text-mist-500">
            {items.length}
          </span>
        </h3>
      </div>

      <div className="relative -mx-1">
        <div
          ref={scrollerRef}
          role="region"
          aria-label={`${name} yapımları`}
          tabIndex={0}
          className="row-scroll flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 py-1.5 outline-none focus-visible:ring-1 focus-visible:ring-gold-500/40"
        >
          {items.map((item) => (
            <div
              key={item.id}
              className="w-[calc((100%-0.75rem)/2)] shrink-0 snap-start sm:w-[calc((100%-1.5rem)/3)] lg:w-[calc((100%-3rem)/5)]"
            >
              <PosterCard
                href={`/title/${item.id}`}
                title={item.title}
                subtitle={item.subtitle}
                posterUrl={item.posterUrl}
                backdropUrl={item.backdropUrl}
                trailerUrl={item.trailerUrl}
                rating={item.rating}
                kind={item.kind}
              />
            </div>
          ))}
        </div>

        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-ink-950 via-ink-950/70 to-transparent transition-opacity duration-200 sm:w-20 ${
            canLeft ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-ink-950 via-ink-950/70 to-transparent transition-opacity duration-200 sm:w-20 ${
            canRight ? "opacity-100" : "opacity-0"
          }`}
        />

        <RowArrow
          side="left"
          direction={-1}
          label={`${name} satırını sola kaydır`}
          disabled={!canLeft}
          onClick={() => scrollByPage(-1)}
        />
        <RowArrow
          side="right"
          direction={1}
          label={`${name} satırını sağa kaydır`}
          disabled={!canRight}
          onClick={() => scrollByPage(1)}
        />
      </div>
    </section>
  );
}

function RowArrow({
  side,
  direction,
  label,
  disabled,
  onClick,
}: {
  side: "left" | "right";
  direction: 1 | -1;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`absolute ${
        side === "left" ? "left-0.5" : "right-0.5"
      } top-1/2 z-10 hidden h-[66px] w-[66px] -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-ink-950/85 text-mist-100 shadow-[0_8px_24px_-10px_rgba(0,0,0,0.9)] backdrop-blur transition-all duration-200 hover:border-gold-500/50 hover:bg-ink-900 hover:text-gold-300 focus-visible:opacity-100 disabled:pointer-events-none disabled:opacity-0 sm:grid lg:h-[72px] lg:w-[72px] ${
        disabled ? "" : "opacity-0 group-hover/row:opacity-100"
      }`}
    >
      <svg
        width="30"
        height="30"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="lg:h-[33px] lg:w-[33px]"
      >
        <path d={direction === -1 ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
      </svg>
    </button>
  );
}
