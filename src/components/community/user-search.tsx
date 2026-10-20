"use client";

import { useState, useEffect, useRef } from "react";

import { UserCard } from "@/components/community/user-card";

export function UserSearch({
  viewerId,
}: {
  viewerId: string | null;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ id: string; displayName: string }>>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastQueryRef = useRef(query);

  useEffect(() => {
    lastQueryRef.current = query;
  }, [query]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || query.length < 2) return;

    debounceRef.current = setTimeout(async () => {
      const currentQuery = lastQueryRef.current;
      if (currentQuery.trim().length < 2) return;

      setLoading(true);
      try {
        const response = await fetch(`/api/users/search?q=${encodeURIComponent(currentQuery)}`);
        if (response.ok) {
          const data = (await response.json()) as { items: Array<{ id: string; displayName: string }> };
          setResults(data.items);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Derive display results from query + results state
  const displayResults = query.trim().length >= 2 ? results : [];

  return (
    <section className="surface p-4 sm:p-5">
      <h2 className="section-title">Kullanıcı ara</h2>
      <p className="muted mt-0.5 text-sm">
        Kullanıcı adı veya görünen isimle arama yapın (en az 2 karakter).
      </p>

      <div className="mt-3 relative">
        <input
          type="search"
          className="field w-full pl-10 pr-4"
          placeholder="Kullanıcı ara..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-mist-500" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg className="animate-spin h-5 w-5 text-gold-400" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        )}
      </div>

      {displayResults.length === 0 && query.trim().length >= 2 && !loading ? (
        <p className="muted mt-3 text-center">Kullanıcı bulunamadı.</p>
      ) : displayResults.length > 0 ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {displayResults.map((user) => (
            <UserCard key={user.id} {...user} viewerId={viewerId} showActions={true} />
          ))}
        </div>
      ) : null}
    </section>
  );
}