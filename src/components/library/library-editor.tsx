"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

import type { WatchStatus } from "@/lib/db/schema";
import { useOfflineQueue } from "@/hooks/useBackgroundSync";

type Entry = {
  id: string;
  status: WatchStatus;
  rating: number | null;
  watchedAt: string | null;
  watchedPeriod: string | null;
  notes: string | null;
  likedAspects: string | null;
  dislikedAspects: string | null;
  memorableScenes: string | null;
  rewatchIntent: "yes" | "maybe" | "no" | null;
  progressSeason: number | null;
  progressEpisode: number | null;
  isFavorite: boolean;
} | null;

const STATUS_ORDER: WatchStatus[] = [
  "watched",
  "watching",
  "watchlist",
  "dropped",
  "not_watched",
  "unsure",
];

/* Kompakt rozet etiketleri (dar ekranda sarma olmasin) */
const STATUS_SHORT: Record<WatchStatus, string> = {
  watched: "İzledim",
  watching: "İzliyorum",
  watchlist: "Listemde",
  dropped: "Yarım",
  not_watched: "İzlemedim",
  unsure: "Emin değilim",
};

const REWATCH_LABELS: Record<string, string> = {
  yes: "Tekrar izlerim",
  maybe: "Belki",
  no: "Hayır",
};

export function LibraryEditor({
  titleId,
  titleName,
  isSeries,
  entry,
  isLoggedIn,
}: {
  titleId: string;
  titleName: string;
  isSeries: boolean;
  entry: Entry;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<WatchStatus>(entry?.status ?? "watched");
  const [rating, setRating] = useState<number | null>(entry?.rating ?? null);
  const [notes, setNotes] = useState(entry?.notes ?? "");
  const [likedAspects, setLikedAspects] = useState(entry?.likedAspects ?? "");
  const [dislikedAspects, setDislikedAspects] = useState(
    entry?.dislikedAspects ?? ""
  );
  const [memorableScenes, setMemorableScenes] = useState(
    entry?.memorableScenes ?? ""
  );
  const [watchedPeriod, setWatchedPeriod] = useState(entry?.watchedPeriod ?? "");
  const [rewatchIntent, setRewatchIntent] = useState<"yes" | "maybe" | "no" | "">(
    entry?.rewatchIntent ?? ""
  );
  const [progressSeason, setProgressSeason] = useState<number | "">(
    entry?.progressSeason ?? ""
  );
  const [progressEpisode, setProgressEpisode] = useState<number | "">(
    entry?.progressEpisode ?? ""
  );
  const [isFavorite, setIsFavorite] = useState(entry?.isFavorite ?? false);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const { addLibraryEntry, updateLibraryEntry, deleteLibraryEntry } =
    useOfflineQueue();

  useEffect(() => {
    setOnline(navigator.onLine);
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  async function handleSave() {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }

    setSaving(true);
    setMessage(null);
    setError(null);

    const payload = {
      titleId,
      status,
      rating,
      notes: notes.trim() || null,
      likedAspects: likedAspects.trim() || null,
      dislikedAspects: dislikedAspects.trim() || null,
      memorableScenes: memorableScenes.trim() || null,
      watchedPeriod: watchedPeriod.trim() || null,
      rewatchIntent: rewatchIntent || null,
      progressSeason: progressSeason === "" ? null : Number(progressSeason),
      progressEpisode: progressEpisode === "" ? null : Number(progressEpisode),
      isFavorite,
    };

    try {
      if (!online) {
        if (entry) {
          await updateLibraryEntry(entry.id, {
            ...payload,
            rating: payload.rating ?? undefined,
            notes: payload.notes ?? undefined,
            likedAspects: payload.likedAspects ?? undefined,
            dislikedAspects: payload.dislikedAspects ?? undefined,
            memorableScenes: payload.memorableScenes ?? undefined,
            watchedPeriod: payload.watchedPeriod ?? undefined,
          });
        } else {
          await addLibraryEntry(titleId, status, rating ?? undefined);
        }
        setMessage("Çevrimdışı — online olduğunda senklenecek.");
        return;
      }

      const response = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Kaydedilemedi.");
        return;
      }

      setMessage("Kaydedildi.");
      router.refresh();
    } catch {
      if (entry) {
        await updateLibraryEntry(entry.id, {
          ...payload,
          rating: payload.rating ?? undefined,
          notes: payload.notes ?? undefined,
          likedAspects: payload.likedAspects ?? undefined,
          dislikedAspects: payload.dislikedAspects ?? undefined,
          memorableScenes: payload.memorableScenes ?? undefined,
          watchedPeriod: payload.watchedPeriod ?? undefined,
        });
      } else {
        await addLibraryEntry(titleId, status, rating ?? undefined);
      }
      setMessage("Kaydedildi (offline kuyruğa alındı).");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!entry) return;
    setSaving(true);
    setError(null);
    try {
      if (!online) {
        await deleteLibraryEntry(entry.id);
        setMessage("Çevrimdışı — online olduğunda silinecek.");
        return;
      }

      const response = await fetch(`/api/library?entryId=${entry.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "Silinemedi.");
        return;
      }
      setMessage("Kütüphaneden çıkarıldı.");
      router.refresh();
    } catch {
      await deleteLibraryEntry(entry.id);
      setMessage("Silme işlemi kuyruğa alındı.");
    } finally {
      setSaving(false);
    }
  }

  if (!isLoggedIn) {
    return (
      <div className="surface p-4">
        <h2 className="section-title">Kişisel hafızanız</h2>
        <p className="muted mt-1 text-sm">
          Puan vermek ve izleme durumunuzu kaydetmek için giriş yapın.
        </p>
        <div className="mt-3 flex gap-2">
          <a href="/login" className="btn btn-primary">
            Giriş yap
          </a>
          <a href="/register" className="btn btn-ghost">
            Kayıt ol
          </a>
        </div>
      </div>
    );
  }

  /* --------------------------------------------------- Kompakt görünüm */

  const detailCount = [
    notes.trim(),
    likedAspects.trim(),
    dislikedAspects.trim(),
    memorableScenes.trim(),
    watchedPeriod.trim(),
    rewatchIntent,
  ].filter(Boolean).length;

  return (
    <section className="surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="section-title">Kişisel hafızanız</h2>
          <p className="muted mt-0.5 text-xs">
            {entry
              ? "Kayıtlı — değişiklikler anında kaydedilir."
              : "Bu yapımı kütüphanenize ekleyin."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsFavorite((value) => !value)}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? "Favorilerden çıkar" : "Favorilere ekle"}
          className={`btn shrink-0 px-2 ${isFavorite ? "btn-primary" : "btn-ghost"}`}
          title={isFavorite ? "Favorilerden çıkar" : "Favorilere ekle"}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill={isFavorite ? "currentColor" : "none"}
            aria-hidden="true"
          >
            <path
              d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.8l5.9-.9z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* Durum — hep gorunur */}
      <div className="mt-3">
        <span className="label">İzleme durumu</span>
        <div
          className="mt-1 flex flex-wrap gap-1"
          role="group"
          aria-label="İzleme durumu"
        >
          {STATUS_ORDER.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatus(value)}
              aria-pressed={status === value}
              className={`rounded-md border px-2 py-1 text-[0.7rem] font-medium transition-colors ${
                status === value
                  ? "border-gold-500/50 bg-gold-500/15 text-gold-300"
                  : "border-ink-600 bg-ink-900 text-mist-400 hover:border-ink-500"
              }`}
            >
              {STATUS_SHORT[value]}
            </button>
          ))}
        </div>
      </div>

      {/* Puan — hep gorunur */}
      <div className="mt-3">
        <span className="label">
          Puanınız {rating ? `· ${rating}/10` : "· verilmedi"}
        </span>
        <div className="mt-1 flex flex-wrap gap-1">
          {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(rating === value ? null : value)}
              aria-pressed={rating === value}
              aria-label={`${value} puan`}
              className={`h-7 w-7 rounded-md border text-xs font-semibold transition-colors ${
                rating !== null && value <= rating
                  ? "border-gold-500/60 bg-gold-500/25 text-gold-200"
                  : "border-ink-600 bg-ink-900 text-mist-500 hover:border-ink-500"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      {/* Detay ozeti */}
      {entry && detailCount > 0 ? (
        <div className="mt-3 rounded-lg border border-ink-700 bg-ink-900/60 p-2.5">
          <p className="label mb-1">Kayıtlı detaylar</p>
          <div className="flex flex-wrap gap-1.5">
            {entry.watchedPeriod && (
              <span className="chip text-[0.65rem]">{entry.watchedPeriod}</span>
            )}
            {entry.rewatchIntent && (
              <span className="chip text-[0.65rem]">
                {REWATCH_LABELS[entry.rewatchIntent]}
              </span>
            )}
            {isSeries && entry.progressSeason != null && (
              <span className="chip text-[0.65rem]">
                {entry.progressSeason}. sezon
                {entry.progressEpisode != null
                  ? ` · ${entry.progressEpisode}. bölüm`
                  : ""}
              </span>
            )}
            {entry.notes && (
              <span className="chip max-w-full truncate text-[0.65rem]">
                “{entry.notes.slice(0, 40)}”
              </span>
            )}
            {entry.likedAspects && (
              <span className="chip text-[0.65rem]">
                ♥ {entry.likedAspects.slice(0, 24)}
              </span>
            )}
            {entry.dislikedAspects && (
              <span className="chip text-[0.65rem]">
                ✕ {entry.dislikedAspects.slice(0, 24)}
              </span>
            )}
            {entry.memorableScenes && (
              <span className="chip text-[0.65rem]">
                ★ {entry.memorableScenes.slice(0, 24)}
              </span>
            )}
          </div>
        </div>
      ) : null}

      {/* Detay formu — acilir/kapanir */}
      {expanded ? (
        <div className="mt-3 flex flex-col gap-3 border-t border-ink-700 pt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="watchedPeriod" className="label">
                İzleme dönemi
              </label>
              <input
                id="watchedPeriod"
                type="text"
                value={watchedPeriod}
                onChange={(event) => setWatchedPeriod(event.target.value)}
                placeholder="Örn. 2023 yazı, Ekim 2024"
                className="field"
              />
            </div>
            <div>
              <label htmlFor="rewatch" className="label">
                Yeniden izleme isteği
              </label>
              <select
                id="rewatch"
                value={rewatchIntent}
                onChange={(event) =>
                  setRewatchIntent(
                    event.target.value as "yes" | "maybe" | "no" | ""
                  )
                }
                className="field"
              >
                <option value="">Belirtilmedi</option>
                <option value="yes">Evet</option>
                <option value="maybe">Belki</option>
                <option value="no">Hayır</option>
              </select>
            </div>
          </div>

          {isSeries ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="progressSeason" className="label">
                  İzlediğiniz son sezon
                </label>
                <input
                  id="progressSeason"
                  type="number"
                  min={0}
                  max={200}
                  value={progressSeason}
                  onChange={(event) =>
                    setProgressSeason(
                      event.target.value === ""
                        ? ""
                        : Number(event.target.value)
                    )
                  }
                  className="field"
                  placeholder="Örn. 2"
                />
              </div>
              <div>
                <label htmlFor="progressEpisode" className="label">
                  Son bölüm
                </label>
                <input
                  id="progressEpisode"
                  type="number"
                  min={0}
                  max={5000}
                  value={progressEpisode}
                  onChange={(event) =>
                    setProgressEpisode(
                      event.target.value === ""
                        ? ""
                        : Number(event.target.value)
                    )
                  }
                  className="field"
                  placeholder="Örn. 7"
                />
              </div>
            </div>
          ) : null}

          <div>
            <label htmlFor="notes" className="label">
              Kişisel yorumunuz
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              maxLength={5000}
              className="field resize-y"
              placeholder="Bu yapım hakkında ne düşünüyorsunuz?"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="liked" className="label">
                Beğendiğiniz yönler
              </label>
              <textarea
                id="liked"
                value={likedAspects}
                onChange={(event) => setLikedAspects(event.target.value)}
                rows={2}
                maxLength={2000}
                className="field resize-y"
                placeholder="Örn. atmosfer, diyaloglar"
              />
            </div>
            <div>
              <label htmlFor="disliked" className="label">
                Beğenmediğiniz yönler
              </label>
              <textarea
                id="disliked"
                value={dislikedAspects}
                onChange={(event) => setDislikedAspects(event.target.value)}
                rows={2}
                maxLength={2000}
                className="field resize-y"
                placeholder="Örn. tempo, final"
              />
            </div>
          </div>

          <div>
            <label htmlFor="scenes" className="label">
              Hatırladığınız sahneler / temalar
            </label>
            <textarea
              id="scenes"
              value={memorableScenes}
              onChange={(event) => setMemorableScenes(event.target.value)}
              rows={2}
              maxLength={2000}
              className="field resize-y"
            />
          </div>
        </div>
      ) : null}

      {!online && (
        <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Çevrimdışısınız — değişiklikler online olduğunda senklenecek.
        </p>
      )}

      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-400"
        >
          {error}
        </p>
      ) : null}
      {message ? (
        <p
          role="status"
          className="mt-3 rounded-lg border border-jade-500/40 bg-jade-500/10 px-3 py-2 text-sm text-jade-400"
        >
          {message}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary"
        >
          {saving
            ? "Kaydediliyor…"
            : entry
            ? "Kaydet"
            : "Kütüphaneye ekle"}
        </button>

        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="btn btn-ghost"
          aria-expanded={expanded}
        >
          {expanded ? "Detayları gizle" : "Detay ekle"}
        </button>

        {entry ? (
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving}
            className="btn btn-ghost text-rose-400 hover:bg-rose-500/10"
          >
            Kaldır
          </button>
        ) : null}

        <span className="ml-auto text-[0.65rem] text-mist-500">
          {titleName} · yalnızca size görünür
        </span>
      </div>
    </section>
  );
}
