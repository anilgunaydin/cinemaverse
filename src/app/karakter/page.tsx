"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface EnrichedItem {
  text: string;
  oran: number | null;
}

interface Profile {
  arketip: string;
  ozet: string;
  gucluYonler: EnrichedItem[];
  tercihEdilenUnsurlar: EnrichedItem[];
  kaaciklanmamisAlanlar: EnrichedItem[];
  oneriler: { baslik: string; aciklama: string }[];
  sinemaMottosu: string;
  hata?: string;
  ham?: string;
}

/** Eski (düz metin) ve yeni (zenginleştirilmiş) formatlari destekler */
function toItems(value: any): EnrichedItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) =>
    typeof item === "string"
      ? { text: item, oran: null }
      : { text: String(item?.text ?? ""), oran: item?.oran ?? null }
  );
}

export default function KarakterPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/karakter")
      .then((r) => r.json())
      .then((data) => {
        setProfile(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Profil yüklenemedi");
        setLoading(false);
      });
  }, []);

  async function handleShare() {
    const shareUrl = `${window.location.origin}/karakter`;
    const ogUrl = `${window.location.origin}/api/og/karakter`;
    const text = "Sinema karakterim: CinemaVerse'da kütüphanemden yola çıkarak çıkarılan profilim";

    try {
      if (navigator.share) {
        await navigator.share({ title: "Sinema Karakterim", text, url: shareUrl });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${shareUrl}\n${ogUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Paylasim iptal edildi
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl py-10 px-4">
        <header className="mb-10 text-center">
          <h1 className="font-display text-4xl font-bold text-mist-100 mb-2">Sinema Karakterin</h1>
          <p className="text-mist-400">Kütüphanenden yola çıkarak AI'nın çizdiği profilin.</p>
        </header>
        <ProfileSkeleton />
      </main>
    );
  }

  if (error || !profile || profile.hata) {
    return (
      <main className="mx-auto max-w-3xl py-10 px-4">
        <header className="mb-10 text-center">
          <h1 className="font-display text-4xl font-bold text-mist-100 mb-2">Sinema Karakterin</h1>
          <p className="text-mist-400">Kütüphanenden yola çıkarak AI'nın çizdiği profilin.</p>
        </header>
        <div className="rounded-2xl border border-ink-700 bg-ink-850/80 p-8 text-center">
          <p className="text-mist-400 mb-2">{error ?? profile?.hata ?? "Profil oluşturulamadı."}</p>
          {profile?.ham && (
            <pre className="text-xs text-mist-500 overflow-auto max-h-60 p-4 bg-ink-900 rounded text-left">
              {profile.ham}
            </pre>
          )}
          <button
            onClick={() => window.location.reload()}
            className="mt-4 btn btn-primary"
          >
            Tekrar Dene
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl py-10 px-4">
      <header className="mb-10 text-center">
        <h1 className="font-display text-4xl font-bold text-mist-100 mb-2">Sinema Karakterin</h1>
        <p className="text-mist-400">Kütüphanenden yola çıkarak AI'nın çizdiği profilin.</p>
        <button
          onClick={handleShare}
          className="btn btn-outline mt-4 inline-flex items-center gap-2"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.6" y1="10.5" x2="15.4" y2="6.5" />
            <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
          </svg>
          {copied ? "Bağlantı kopyalandı ✓" : "Paylaş"}
        </button>
      </header>
      <div className="space-y-6">
        {/* Arketip + Motto */}
        <div className="rounded-2xl border border-gold-500/30 bg-gradient-to-br from-gold-500/10 to-ink-900 p-6 text-center">
          <p className="text-sm text-gold-300 uppercase tracking-wide mb-1">Sinema Arketipin</p>
          <h2 className="font-display text-3xl font-bold text-mist-100 mb-3">{profile.arketip ?? "—"}</h2>
          <p className="text-lg text-mist-300 italic">"{profile.sinemaMottosu ?? "Sinema bir zaman makinesidir."}"</p>
        </div>

        {/* Özet */}
        <section className="rounded-2xl border border-ink-700 bg-ink-850/80 p-5">
          <h3 className="font-semibold text-mist-100 mb-2 flex items-center gap-2">
            <span className="text-gold-300">📝</span> Kişilik Özeti
          </h3>
          <p className="text-mist-300 leading-relaxed">{profile.ozet ?? "—"}</p>
        </section>

        {/* Güçlü yönler & Tercih edilen unsurlari */}
        <div className="grid gap-4 sm:grid-cols-2">
          <section className="rounded-2xl border border-ink-700 bg-ink-850/80 p-5">
            <h3 className="font-semibold text-mist-100 mb-3 flex items-center gap-2">
              <span className="text-gold-300">💪</span> Güçlü Yönlerin
            </h3>
            <ul className="space-y-2">
              {toItems(profile.gucluYonler).map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-mist-300">
                  <span className="text-gold-300">→</span>
                  <span>{item.text}</span>
                  {item.oran != null ? (
                    <span className="chip chip-gold ml-auto text-[0.65rem]">
                      %{item.oran}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-ink-700 bg-ink-850/80 p-5">
            <h3 className="font-semibold text-mist-100 mb-3 flex items-center gap-2">
              <span className="text-gold-300">🎯</span> Tercih Edilen Unsurlar
            </h3>
            <ul className="space-y-2">
              {toItems(profile.tercihEdilenUnsurlar).map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-mist-300">
                  <span className="text-gold-300">→</span>
                  <span>{item.text}</span>
                  {item.oran != null ? (
                    <span className="chip chip-gold ml-auto text-[0.65rem]">
                      %{item.oran}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Kaçırılan alanlar */}
        <section className="rounded-2xl border border-ink-700 bg-ink-850/80 p-5">
          <h3 className="font-semibold text-mist-100 mb-3 flex items-center gap-2">
            <span className="text-gold-300">🕳️</span> Keşfedilmemiş Alanlar
          </h3>
          <ul className="space-y-2">
            {toItems(profile.kaaciklanmamisAlanlar).map((item, i) => (
              <li key={i} className="flex items-center gap-2 text-mist-400">
                <span className="text-gold-500/70">○</span>
                <span>{item.text}</span>
                {item.oran != null ? (
                  <span className="chip ml-auto text-[0.65rem]">%{item.oran}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        {/* AI Önerileri - ustteki tahminlerle ayni form */}
        <section className="rounded-2xl border border-ink-700 bg-ink-850/80 p-5">
          <h3 className="font-semibold text-mist-100 mb-3 flex items-center gap-2">
            <span className="text-gold-300">🤖</span> Sana Özel Öneriler
          </h3>
          <ul className="space-y-2">
            {(profile.oneriler ?? []).map((rec: any, i: number) => (
              <li key={i} className="flex items-start gap-2 text-mist-300">
                <span className="mt-0.5 text-gold-300">→</span>
                <span className="min-w-0">
                  <span className="font-medium text-mist-100">{rec.baslik}</span>
                  <span className="block text-sm text-mist-400">
                    {rec.aciklama}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-ink-700 bg-ink-850/80 p-6">
        <div className="h-8 w-48 bg-ink-700 animate-pulse rounded mx-auto mb-3" />
        <div className="h-4 w-64 bg-ink-700 animate-pulse rounded mx-auto" />
      </div>
      <div className="rounded-2xl border border-ink-700 bg-ink-850/80 p-5">
        <div className="h-4 w-32 bg-ink-700 animate-pulse rounded mb-3" />
        <div className="h-4 w-full bg-ink-700 animate-pulse rounded" />
        <div className="h-4 w-3/4 bg-ink-700 animate-pulse rounded mt-2" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-ink-700 bg-ink-850/80 p-5">
          <div className="h-4 w-24 bg-ink-700 animate-pulse rounded mb-3" />
          <div className="space-y-2"><div className="h-4 w-full bg-ink-700 animate-pulse rounded" /><div className="h-4 w-full bg-ink-700 animate-pulse rounded" /></div>
        </div>
        <div className="rounded-2xl border border-ink-700 bg-ink-850/80 p-5">
          <div className="h-4 w-24 bg-ink-700 animate-pulse rounded mb-3" />
          <div className="space-y-2"><div className="h-4 w-full bg-ink-700 animate-pulse rounded" /><div className="h-4 w-full bg-ink-700 animate-pulse rounded" /></div>
        </div>
      </div>
    </div>
  );
}