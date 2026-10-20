"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback, useEffect } from "react";

import { WATCH_STATUS_LABELS } from "@/lib/library/labels";
import type { WatchStatus } from "@/lib/db/schema";
import { useOfflineQueue } from "@/hooks/useBackgroundSync";
import { isOnline } from "@/lib/offline/online";

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
    entry?.dislikedAspects ?? "",
  );
  const [memorableScenes, setMemorableScenes] = useState(
    entry?.memorableScenes ?? "",
  );
  const [watchedPeriod, setWatchedPeriod] = useState(entry?.watchedPeriod ?? "");
  const [rewatchIntent, setRewatchIntent] = useState<"yes" | "maybe" | "no" | "">(
    entry?.rewatchIntent ?? "",
  );
  const [progressSeason, setProgressSeason] = useState<number | "">(
    entry?.progressSeason ?? "",
  );
  const [progressEpisode, setProgressEpisode] = useState<number | "">(
    entry?.progressEpisode ?? "",
  );
  const [isFavorite, setIsFavorite] = useState(entry?.isFavorite ?? false);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);

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
      notes: notes.trim() || undefined,
      likedAspects: likedAspects.trim() || undefined,
      dislikedAspects: dislikedAspects.trim() || undefined,
      memorableScenes: memorableScenes.trim() || undefined,
      watchedPeriod: watchedPeriod.trim() || undefined,
      rewatchIntent: rewatchIntent || undefined,
      progressSeason: progressSeason === "" ? undefined : Number(progressSeason),
      progressEpisode: progressEpisode === "" ? undefined : Number(progressEpisode),
      isFavorite,
    };

    try {
      if (!online) {
        // Queue for later sync
        if (entry) {
          await updateLibraryEntry(entry.id, {
            ...payload,
            rating: payload.rating ?? undefined,
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
      // If network error, queue for later
      if (entry) {
        await updateLibraryEntry(entry.id, {
          ...payload,
          rating: payload.rating ?? undefined,
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
        <p className="muted mt-1">
          Puan vermek, yorum yazmak ve izleme durumunuzu kaydetmek için giriş
          yapın. Verileriniz yalnızca size görünür.
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

  return (
    <div className="surface p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="section-title">Kişisel hafızanız</h2>
          <p className="muted mt-0.5">
            {entry
              ? "Bu yapım kütüphanenizde kayıtlı."
              : "Bu yapımı kütüphanenize ekleyin."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsFavorite((value) => !value)}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? "Favorilerden çıkar" : "Favorilere ekle"}
          className={`btn ${isFavorite ? "btn-primary" : "btn-ghost"} px-2.5`}
          title={isFavorite ? "Favorilerden çıkar" : "Favorilere ekle"}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={isFavorite ? "currentColor" : "none"} aria-hidden="true">
            <path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.8l5.9-.9z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Online/Offline indicator */}
      {!online && (
        <div className="mt-3 p-3 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center gap-2 text-amber-300 text-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M16.72 11.06A10.94 10.94 0 0 1 12 18.79a10.94 10.94 0 0 1-4.72-7.73" />
          </svg>
          <span>Çevrimdışı — değişiklikler online olduğunda senklenecek</span>
        </div>
      )}

      <div className="mt-4">
        <span className="label">İzleme durumu</span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="İzleme durumu">
          {STATUS_ORDER.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatus(value)}
              aria-pressed={status === value}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                status === value
                  ? "border-gold-500/50 bg-gold-500/15 text-gold-300"
                  : "border-ink-600 bg-ink-900 text-mist-400 hover:text-mist-200"
              }`}
            >
              {WATCH_STATUS_LABELS[value]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="rating" className="label">
            Puanınız {rating ? `· ${rating}/10` : "· verilmedi"}
          </label>
          <div className="flex flex-wrap gap-1">
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
          <p className="mt-1 text-[0.68rem] text-mist-500">
            Puan vermezseniz sistem sizin adınıza puan üretmez.
          </p>
        </div>

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
      </div>

      {isSeries ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
                setProgressSeason(event.target.value === "" ? "" : Number(event.target.value))
              }
              className="field"
              placeholder="Örn. 2"
            />
          </div>
          <div>
            <label htmlFor="progressEpisode" className="label">
              Son bölüm (isteğe bağlı)
            </label>
            <input
              id="progressEpisode"
              type="number"
              min={0}
              max={5000}
              value={progressEpisode}
              onChange={(event) =>
                setProgressEpisode(event.target.value === "" ? "" : Number(event.target.value))
              }
              className="field"
              placeholder="Örn. 7"
            />
          </div>
          <p className="muted sm:col-span-2">
            Bu bilgi spoiler filtresi için kullanılır: yalnızca izlediğiniz
            noktaya kadar olan içerik gösterilir.
          </p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-3">
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

        <div>
          <label htmlFor="rewatch" className="label">
            Yeniden izleme isteği
          </label>
          <select
            id="rewatch"
            value={rewatchIntent}
            onChange={(event) =>
              setRewatchIntent(event.target.value as "yes" | "maybe" | "no" | "")
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

      {error ? (
        <p role="alert" className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="mt-3 rounded-lg border border-jade-500/40 bg-jade-500/10 px-3 py-2 text-sm text-jade-400">
          {message}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary"
        >
          {saving ? "Kaydediliyor…" : entry ? "Değişiklikleri kaydet" : "Kütüphaneye ekle"}
        </button>
        {entry ? (
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving}
            className="btn btn-danger"
          >
            Kütüphaneden çıkar
          </button>
        ) : null}
      </div>

      <p className="mt-3 text-[0.68rem] text-mist-500">
        {titleName} için kayıtlarınız yalnızca size görünür.
      </p>
    </div>
  );
}