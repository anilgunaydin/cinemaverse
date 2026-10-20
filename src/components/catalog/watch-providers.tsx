"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type MonetizationType = "flatrate" | "rent" | "buy" | "free" | "ads";

const LABELS: Record<MonetizationType, { label: string; icon: string; color: string }> = {
  flatrate: { label: "Abonelikle", icon: "📺", color: "text-jade-400" },
  rent: { label: "Kiralama", icon: "💰", color: "text-gold-400" },
  buy: { label: "Satın Al", icon: "🛒", color: "text-rose-400" },
  free: { label: "Ücretsiz", icon: "🆓", color: "text-sky-400" },
  ads: { label: "Reklamlı", icon: "📺", color: "text-amber-400" },
};

const MONETIZATION_ORDER: MonetizationType[] = ["flatrate", "rent", "buy", "free", "ads"];

interface Provider {
  providerId: number;
  name: string;
  logoPath: string | null;
  displayPriority: number;
  link: string | null;
  quality: string | null;
  region: string;
  lastChecked: string;
}

export function WatchProviders({
  titleId,
  initialProviders,
}: {
  titleId: string;
  initialProviders?: Record<string, any[]> | null;
}) {
  const [data, setData] = useState<Record<string, any[]>>(
    initialProviders ?? {}
  );
  const [loading, setLoading] = useState(!initialProviders);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialProviders) return;
    let cancelled = false;
    async function fetchData() {
      try {
        const res = await fetch(`/api/titles/${titleId}/watch-providers`);
        if (!res.ok) throw new Error("Failed to fetch");
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [titleId, initialProviders]);

  if (loading) {
    return (
      <div className="surface p-4 animate-pulse">
        <h3 className="section-title mb-3">Yayın Platformları</h3>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-ink-800" />
              <div className="flex-1 space-y-1">
                <div className="h-4 w-1/4 bg-ink-800 rounded" />
                <div className="h-3 w-1/2 bg-ink-800 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="surface p-4 text-center text-rose-400">
        Platform bilgisi yüklenemedi.
      </div>
    );
  }

  const hasData = Object.keys(data).length > 0;
  if (!hasData) {
    return (
      <div className="surface p-4 text-center text-mist-500">
        Türkiye'de yayın platformu bilgisi bulunamadı.
      </div>
    );
  }

  return (
    <div className="surface p-4">
      <h2 className="section-title">Yayın Platformları (Türkiye)</h2>
      <p className="mt-1 text-[0.7rem] text-mist-500">
        Birden fazla platformda varsa seçiminize bırakın.
      </p>
      <div className="mt-3 space-y-3">
        {MONETIZATION_ORDER.map((mType) => {
          const providers = data[mType];
          if (!providers || providers.length === 0) return null;
          const { label, icon, color } = LABELS[mType];
          return (
            <section key={mType} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className={color} role="img" aria-label={label}>
                  {icon}
                </span>
                <h3 className="text-sm font-semibold text-mist-100">{label}</h3>
                <span className="text-[0.65rem] text-mist-500">
                  {providers.length} platform
                </span>
              </div>
              <div className="grid gap-1.5">
                {providers
                  .sort((a, b) => a.displayPriority - b.displayPriority)
                  .map((p) => (
                    <ProviderCard key={`${p.providerId}-${p.region}`} provider={p} />
                  ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function ProviderCard({ provider }: { provider: any }) {
  const logoUrl = provider.logoPath
    ? `https://image.tmdb.org/t/p/w92${provider.logoPath}`
    : undefined;

  return (
    <a
      href={provider.link ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-850/80 p-3 transition-colors hover:border-gold-500/40 hover:shadow-[0_4px_16px_-4px_rgba(212,169,79,0.2)]"
      aria-label={`${provider.name} platformunda izle`}
    >
      {provider.logoPath ? (
        <Image
          src={logoUrl!}
          alt={`${provider.name} logo`}
          width={36}
          height={36}
          className="rounded-lg object-contain bg-ink-800 p-1"
          unoptimized
        />
      ) : (
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-ink-800 text-mist-500 text-xs font-medium">
          {provider.name.slice(0, 2).toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-mist-100 truncate">{provider.name}</p>
        <div className="flex items-center gap-2 mt-1 text-xs text-mist-500">
          {provider.quality && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-ink-700 text-gold-300">
              {provider.quality.toUpperCase()}
            </span>
          )}
          <span className="text-mist-400">TR</span>
        </div>
      </div>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="text-mist-400 group-hover:text-gold-300 transition-colors flex-shrink-0"
        aria-hidden="true"
      >
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
    </a>
  );
}