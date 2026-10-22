"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

function extractId(url: string | null | undefined): string | null {
  if (!url) return null;
  const watch = url.match(/v=([\w-]{6,})/);
  if (watch?.[1]) return watch[1];
  const short = url.match(/youtu\.be\/([\w-]{6,})/);
  return short?.[1] ?? null;
}

/* --- kuresel ses durumu: bir afiste acilan ses butun afislerde acik --- */
let globalMuted = true;
const muteListeners = new Set<() => void>();

function setGlobalMuted(muted: boolean) {
  globalMuted = muted;
  muteListeners.forEach((listener) => listener());
}

function subscribeMute(listener: () => void) {
  muteListeners.add(listener);
  return () => {
    muteListeners.delete(listener);
  };
}

function getGlobalMuted() {
  return globalMuted;
}

/**
 * Netflix-stili hover fragman — kartin ICINDE oynar.
 *
 * - Panel buyumez, karttan tasmaz; 16:9 gorsel alanini kaplar.
 * - Kart hover'inda buyume/ziplama yok (PosterCard tarafinda da kapali).
 * - Ses KÜRESEL: bir kartta acilan ses butun kartlarda acik kalir.
 * - Karttan cikinca, scroll/resize'da kapanir.
 */
export default function HoverTrailer({
  trailerUrl,
}: {
  trailerUrl?: string | null;
}) {
  const [active, setActive] = useState(false);
  const muted = useSyncExternalStore(
    subscribeMute,
    getGlobalMuted,
    getGlobalMuted,
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = extractId(trailerUrl);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    const close = () => setActive(false);
    window.addEventListener("scroll", close, { passive: true });
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close);
      window.removeEventListener("resize", close);
    };
  }, [active]);

  if (!id) return null;

  const open = () => setActive(true);

  const close = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setActive(false);
  };

  return (
    <div
      data-hover-trailer
      className="absolute inset-0 z-10"
      onMouseEnter={() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          if (timerRef.current) clearTimeout(timerRef.current);
          open();
        }, 200);
      }}
      onMouseLeave={close}
    >
      {active ? (
        <div
          data-hover-trailer-panel
          className="absolute inset-0 overflow-hidden bg-ink-900"
          aria-label="Fragman ön izleme"
        >
          <iframe
            key={`htp-${muted ? "m" : "s"}`}
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=${
              muted ? 1 : 0
            }&loop=1&playlist=${id}&playsinline=1&rel=0&modestbranding=1&controls=0`}
            title="Fragman ön izleme"
            allow="autoplay; encrypted-media"
            className="pointer-events-none absolute inset-0 h-full w-full"
            style={{ border: 0 }}
          />
          <button
            type="button"
            title={
              muted
                ? "Sesi aç (tüm afişler için)"
                : "Sesi kapat (tüm afişler için)"
            }
            aria-label={
              muted
                ? "Sesi aç (tüm afişler için)"
                : "Sesi kapat (tüm afişler için)"
            }
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setGlobalMuted(!muted);
            }}
            className="absolute bottom-2 right-2 z-10 grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-ink-950/85 text-gold-300 backdrop-blur transition-colors hover:bg-ink-950"
          >
            {muted ? (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path
                  d="M11 5 6 9H3v6h3l5 4V5z"
                  fill="currentColor"
                  stroke="none"
                />
                <path d="M22 9l-6 6M16 9l6 6" />
              </svg>
            ) : (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path
                  d="M11 5 6 9H3v6h3l5 4V5z"
                  fill="currentColor"
                  stroke="none"
                />
                <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
              </svg>
            )}
          </button>
        </div>
      ) : null}
    </div>
  );
}
