"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { normalizeTitle } from "@/lib/catalog/matching";

type SearchResult = {
  provider: string;
  providerId: string;
  kind: "movie" | "series" | "season" | "episode" | "franchise";
  originalTitle: string;
  localizedTitle: string | null;
  releaseYear: number | null;
  releaseDate: string | null;
  overview: string | null;
  posterUrl: string | null;
  imdbId: string | null;
  externalRating: number | null;
  externalRatingSource: string | null;
  matchScore: number;
  sources: string[];
};

type ProviderStatus = { provider: string; error: string | null };

const KIND_LABEL: Record<string, string> = {
  movie: "Film",
  series: "Dizi",
  season: "Sezon",
  episode: "Bölüm",
  franchise: "Seri",
};

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const normalizedQuery = normalizeTitle(query);
  if (!normalizedQuery) return text;
  
  const normalizedText = normalizeTitle(text);
  const regex = new RegExp(`(${normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, index) => 
        regex.test(part) ? (
          <mark key={index} className="bg-gold-500/30 text-gold-200 px-0.5 rounded">{part}</mark>
        ) : (
          part
        )
      )}
    </>
  );
}

export function SearchPanel({ autoFocus = false }: { autoFocus?: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [normalizedQuery, setNormalizedQuery] = useState("");
  const [kind, setKind] = useState<"all" | "movie" | "series">("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [statuses, setStatuses] = useState<ProviderStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importingKey, setImportingKey] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const runSearch = useCallback(
    async (searchQuery: string, searchKind: string) => {
      const trimmed = searchQuery.trim();
      if (trimmed.length < 2) {
        setResults([]);
        setHasSearched(false);
        setError(null);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);
      setImportError(null);

      try {
        const params = new URLSearchParams({ q: trimmed, kind: searchKind });
        const response = await fetch(`/api/search?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as {
          results?: SearchResult[];
          providerStatus?: ProviderStatus[];
          error?: string;
        };

        if (!response.ok) {
          setError(data.error ?? "Arama başarısız oldu.");
          setResults([]);
        } else {
          setResults(data.results ?? []);
          setStatuses(data.providerStatus ?? []);
        }
        setHasSearched(true);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError("Sunucuya ulaşılamadı.");
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    setNormalizedQuery(normalizeTitle(query));
    const timer = setTimeout(() => {
      if (query.trim().length >= 2) {
        void runSearch(query, kind);
      } else {
        setResults([]);
        setHasSearched(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, kind, runSearch]);

  async function handleImport(result: SearchResult) {
    const key = `${result.provider}:${result.providerId}`;
    setImportingKey(key);
    setImportError(null);

    try {
      const response = await fetch("/api/catalog/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: result.provider,
          providerId: result.providerId,
        }),
      });
      const data = (await response.json()) as {
        titleId?: string;
        error?: string;
      };

      if (!response.ok || !data.titleId) {
        setImportError(data.error ?? "Yapım kaydedilemedi.");
        return;
      }

      router.push(`/title/${data.titleId}`);
    } catch {
      setImportError("Sunucuya ulaşılamadı.");
    } finally {
      setImportingKey(null);
    }
  }

  const failedProviders = statuses.filter((status) => status.error);

  return (
    <div className="flex flex-col gap-4">
      <div className="surface p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mist-500"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
              <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={query}
              autoFocus={autoFocus}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Film veya dizi adı yazın…"
              aria-label="Film veya dizi ara"
              className="field pl-9"
            />
          </div>
          <div
            className="flex items-center gap-1 rounded-lg border border-ink-600 bg-ink-900 p-1"
            role="group"
            aria-label="Yapım türü"
          >
            {(
              [
                ["all", "Tümü"],
                ["movie", "Film"],
                ["series", "Dizi"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setKind(value)}
                aria-pressed={kind === value}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  kind === value
                    ? "bg-gold-500/20 text-gold-300"
                    : "text-mist-400 hover:text-mist-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2 text-[0.7rem] text-mist-500">
          Kaynaklar: Wikidata (film/dizi), TVmaze (dizi). Veriler kaynakta
          doğrulandığı şekilde gösterilir; eksik alanlar tahminle doldurulmaz.
        </p>
      </div>

      {failedProviders.length > 0 ? (
        <div className="rounded-lg border border-gold-500/30 bg-gold-500/5 px-3 py-2 text-xs text-gold-300">
          Bazı kaynaklara ulaşılamadı:{" "}
          {failedProviders.map((s) => s.provider).join(", ")}. Diğer kaynakların
          sonuçları gösteriliyor.
        </div>
      ) : null}

      {importError ? (
        <div
          role="alert"
          className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-400"
        >
          {importError}
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-3 text-sm text-rose-400"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex flex-col gap-2" aria-live="polite" aria-busy="true">
          {[0, 1, 2].map((index) => (
            <div key={index} className="surface-flat flex gap-3 p-3">
              <div className="skeleton h-24 w-16 shrink-0" />
              <div className="flex flex-1 flex-col gap-2">
                <div className="skeleton h-4 w-2/5" />
                <div className="skeleton h-3 w-1/5" />
                <div className="skeleton h-3 w-4/5" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!loading && results.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {results.map((result) => {
            const key = `${result.provider}:${result.providerId}`;
            const isImporting = importingKey === key;
            return (
              <li
                key={key}
                className="surface-flat flex gap-3 p-3 transition-colors hover:border-ink-500"
              >
                <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-md bg-ink-800">
                  {result.posterUrl ? (
                    <Image
                      src={result.posterUrl}
                      alt={`${result.originalTitle} posteri`}
                      fill
                      sizes="64px"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-[0.6rem] text-mist-500">
                      Poster
                      <br />
                      yok
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="chip">{KIND_LABEL[result.kind] ?? result.kind}</span>
                    {result.releaseYear ? (
                      <span className="chip">{result.releaseYear}</span>
                    ) : (
                      <span className="chip" title="Kaynakta yayın yılı yok">
                        Yıl bilinmiyor
                      </span>
                    )}
                    {result.externalRating ? (
                      <span className="chip chip-gold">
                        {result.externalRating.toFixed(1)} ·{" "}
                        {result.externalRatingSource === "tvmaze" ? "TVmaze" : "kaynak"}
                      </span>
                    ) : null}
                  </div>

                  <h3 className="mt-1.5 truncate font-medium text-mist-100">
                    {highlightMatch(result.originalTitle, query)}
                  </h3>
                  {result.localizedTitle &&
                  result.localizedTitle !== result.originalTitle ? (
                    <p className="text-xs text-mist-400">{highlightMatch(result.localizedTitle, query)}</p>
                  ) : null}

                  {result.overview ? (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-mist-400">
                      {highlightMatch(result.overview, query)}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs italic text-mist-500">
                      Kaynakta açıklama bulunmuyor.
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleImport(result)}
                      disabled={isImporting}
                      className="btn btn-primary px-3 py-1.5 text-xs"
                    >
                      {isImporting ? "Kaydediliyor…" : "Kütüphaneye ekle"}
                    </button>
                    <span className="text-[0.68rem] text-mist-500">
                      Kaynak: {result.sources.join(", ")}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {!loading && hasSearched && results.length === 0 && !error ? (
        <div className="surface-flat px-4 py-8 text-center">
          <p className="font-medium text-mist-200">Sonuç bulunamadı</p>
          <p className="muted mt-1">
            Farklı bir yazım deneyin veya yapım türü filtresini değiştirin.
          </p>
        </div>
      ) : null}

      {!hasSearched && !loading && !error ? (
        <div className="surface-flat px-4 py-8 text-center">
          <p className="font-medium text-mist-200">Aramaya başlayın</p>
          <p className="muted mt-1">
            En az 2 karakter yazdığınızda kaynaklar taranır.
          </p>
          <Link href="/library" className="btn btn-ghost mt-4">
            Kütüphaneme git
          </Link>
        </div>
      ) : null}
    </div>
  );
}
