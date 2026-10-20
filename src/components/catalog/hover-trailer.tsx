"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

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

type AnchorRect = { left: number; top: number; width: number; height: number };

/**
 * Netflix-stili hover fragman — "önizleme karti" varyanti:
 * - Panel AFIŞLE AYNI dikey siluette (ayni yükseklik) ve ~1.45x geniş.
 * - Üstte TAM KARE 16:9 video (kesme yok, letterbox yok), altta meta bandı:
 *   ad + yıl/tür + puan. Siluet afişle tutarlı; kullanıcı bosluğa
 *   "kart büyüdü" hissi alır, "yatay dursab" tuhaflığı olmaz.
 * - Ses KÜRESEL: bir panelde açılsın tüm kartlar etkilenir.
 * - Karttan/panelden çıkınca, scroll/resize'da kapanır.
 */
export default function HoverTrailer({
  trailerUrl,
  linkHref,
  metaTitle,
  metaSubtitle,
  metaRating,
}: {
  trailerUrl?: string | null;
  linkHref: string;
  metaTitle: string;
  metaSubtitle?: string | null;
  metaRating?: number | null;
}) {
  const [active, setActive] = useState(false);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const muted = useSyncExternalStore(subscribeMute, getGlobalMuted, getGlobalMuted);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
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

  /* panel: genislik ~2.2x kart (1.45x tabana gore toplam +50%), ustte tam kare 16:9 video + 64px meta seridi */
  let panel = { left: 0, top: 0, width: 0, height: 0, videoH: 0 };
  if (anchor) {
    const width = Math.round(Math.min(anchor.width * 2.2, 780));
    const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
    const centerX = anchor.left + anchor.width / 2;
    const left = Math.min(Math.max(centerX - width / 2, 8), vw - width - 8);
    const videoHeight = Math.round((width * 9) / 16);
    panel = {
      left: Math.round(left),
      top: Math.round(anchor.top),
      width,
      height: videoHeight + 64,
      videoH: videoHeight,
    };
  }

  const open = () => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (rect) {
      setAnchor({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    }
    setActive(true);
  };

  const close = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setActive(false);
    setAnchor(null);
  };

  return (
    <div
      ref={wrapperRef}
      className="absolute inset-0 z-10"
      onMouseEnter={() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          if (timerRef.current) clearTimeout(timerRef.current);
          open();
        }, 250);
      }}
      onMouseLeave={(event) => {
        const to = event.relatedTarget as Node | null;
        if (!(to instanceof Element && to.closest("[data-hover-trailer-panel]"))) {
          close();
        }
      }}
    >
      {active && anchor
        ? createPortal(
            <div
              data-hover-trailer-panel
              className="fixed z-[60] flex flex-col overflow-hidden rounded-xl border border-gold-500/40 bg-ink-950 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.75)]"
              style={{
                left: panel.left,
                top: panel.top,
                width: panel.width,
                height: panel.height,
              }}
              onMouseLeave={close}
            >
              {/* video: panelin ust bolumu, tam kare 16:9 */}
              <div
                className="relative shrink-0 overflow-hidden bg-ink-900"
                style={{ height: panel.videoH }}
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
                  title={muted ? "Sesi aç (tüm afişler için)" : "Sesi kapat (tüm afişler için)"}
                  aria-label={muted ? "Sesi aç (tüm afişler için)" : "Sesi kapat (tüm afişler için)"}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setGlobalMuted(!muted);
                  }}
                  className="absolute bottom-2 right-2 z-10 grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-ink-950/85 text-gold-300 backdrop-blur transition-colors hover:bg-ink-950"
                >
                  {muted ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M11 5 6 9H3v6h3l5 4V5z" fill="currentColor" stroke="none" />
                      <path d="M22 9l-6 6M16 9l6 6" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M11 5 6 9H3v6h3l5 4V5z" fill="currentColor" stroke="none" />
                      <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
                    </svg>
                  )}
                </button>
              </div>

              {/* meta bandi: sabit 64px, video altinda */}
              <Link
                href={linkHref}
                className="flex flex-col justify-center gap-1 px-3.5 h-16"
              >
                <p className="line-clamp-2 text-sm font-semibold leading-snug text-mist-100">
                  {metaTitle}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 text-[0.65rem]">
                  {metaSubtitle ? <span className="chip">{metaSubtitle}</span> : null}
                  {metaRating ? (
                    <span className="rounded-md bg-gold-500/90 px-1.5 py-0.5 text-[0.62rem] font-bold text-ink-950">
                      {metaRating.toFixed(1)}
                    </span>
                  ) : null}
                  <span className="ml-auto text-[0.65rem] text-gold-400 hover:underline">
                    Yapıma git →
                  </span>
                </div>
              </Link>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
