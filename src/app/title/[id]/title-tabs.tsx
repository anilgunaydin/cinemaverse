"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

export type TitleTab = {
  id: string;
  label: string;
  icon: string;
  badge?: string | number | null;
  content: React.ReactNode;
};

export function TitleTabs({ tabs }: { tabs: TitleTab[] }) {
  const searchParams = useSearchParams();
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const [stuck, setStuck] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // ?tab=... ile gelen sekmeyi ac
  useEffect(() => {
    const requested = searchParams.get("tab");
    if (requested && tabs.some((t) => t.id === requested)) {
      setActive(requested);
    }
  }, [searchParams, tabs]);

  // Hero gecildiginde sekme cubugunu sticky yap
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting),
      { rootMargin: "-72px 0px 0px 0px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const select = (id: string) => {
    setActive(id);
    // Sayfayi yukariye al - sekme basligi gorunsun
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div>
      {/* Sentinel: sticky tetikleyici */}
      <div ref={sentinelRef} aria-hidden className="h-px" />

      {/* Sekme cubugu */}
      <div
        className={`sticky top-16 z-30 -mx-1 mb-4 bg-ink-950/90 backdrop-blur-xl transition-shadow ${
          stuck ? "border-b border-ink-700 shadow-lg" : "border-b border-transparent"
        }`}
      >
        <nav
          className="flex items-center gap-1 overflow-x-auto py-2"
          aria-label="Yapım sayfası bölümleri"
        >
          {tabs.map((tab) => {
            const isActive = active === tab.id;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabRefs.current[tab.id] = el;
                }}
                onClick={() => select(tab.id)}
                aria-current={isActive ? "page" : undefined}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-gold-500/15 text-gold-300"
                    : "text-mist-400 hover:bg-ink-800 hover:text-mist-200"
                }`}
              >
                <span aria-hidden>{tab.icon}</span>
                {tab.label}
                {tab.badge != null && tab.badge !== 0 && (
                  <span
                    className={`rounded-full px-1.5 text-[0.62rem] font-semibold ${
                      isActive
                        ? "bg-gold-500/25 text-gold-200"
                        : "bg-ink-700 text-mist-400"
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Aktif icerik */}
      <div>
        {tabs.map((tab) =>
          tab.id === active ? (
            <section key={tab.id} className="animate-fade-in">
              {tab.content}
            </section>
          ) : null
        )}
      </div>
    </div>
  );
}
