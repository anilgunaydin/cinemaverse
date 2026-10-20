"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Profile {
  arketip: string;
  ozet: string;
  gucluYonler: string[];
  tercihEdilenUnsurlar: string[];
  kaaciklanmamisAlanlar: string[];
  oneriler: { baslik: string; aciklama: string }[];
  sinemaMottosu: string;
  hata?: string;
  ham?: string;
}

export default function KarakterPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

        /* Güçlü yönler & Tercih edilen unsurlari */
        <div className="grid gap-4 sm:grid-cols-2">
          <section className="rounded-2xl border border-ink-700 bg-ink-850/80 p-5">
            <h3 className="font-semibold text-mist-100 mb-3 flex items-center gap-2">
              <span className="text-gold-300">💪</span> Güçlü Yönlerin
            </h3>
            <ul className="space-y-2">
              {(profile.gucluYonler ?? []).map((item: string, i: number) => (
                <li key={i} className="flex items-center gap-2 text-mist-300">
                  <span className="text-gold-300">→</span> {item}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-ink-700 bg-ink-850/80 p-5">
            <h3 className="font-semibold text-mist-100 mb-3 flex items-center gap-2">
              <span className="text-gold-300">🎯</span> Tercih Edilen Unsurlar
            </h3>
            <ul className="space-y-2">
              {(profile.tercihEdilenUnsurlar ?? []).map((item: string, i: number) => (
                <li key={i} className="flex items-center gap-2 text-mist-300">
                  <span className="text-gold-300">→</span> {item}
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
            {(profile.kaaciklanmamisAlanlar ?? []).map((item: string, i: number) => (
              <li key={i} className="flex items-center gap-2 text-mist-400">
                <span className="text-gold-500/70">○</span> {item}
              </li>
            ))}
          </ul>
        </section>

        {/* AI Önerileri */}
        <section className="rounded-2xl border border-ink-700 bg-ink-850/80 p-5">
          <h3 className="font-semibold text-mist-100 mb-4 flex items-center gap-2">
            <span className="text-gold-300">🤖</span> Sana Özel Öneriler
          </h3>
          <div className="space-y-3">
            {(profile.oneriler ?? []).map((rec: any, i: number) => (
              <div key={i} className="rounded-xl border border-ink-600 bg-ink-900/60 p-4">
                <p className="font-medium text-mist-100">{rec.baslik}</p>
                <p className="text-sm text-mist-400 mt-1">{rec.aciklama}</p>
              </div>
            ))}
          </div>
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