"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

import type { WatchStatus } from "@/lib/db/schema";
import { useOfflineQueue } from "@/hooks/useBackgroundSync";
import { ReportButton } from "@/components/community/report-button";

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

type ReviewItem = {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  rating: number | null;
  containsSpoiler: boolean;
  spoilerScopeSeason: number | null;
  visibility: "public" | "followers" | "private";
  createdAt: string;
};

type SpoilerViewer = {
  userId: string;
  status: WatchStatus | null;
  season: number | null;
  episode: number | null;
};

const STATUS_ORDER: WatchStatus[] = [
  "watched",
  "watching",
  "watchlist",
  "dropped",
  "not_watched",
  "unsure",
];

const STATUS_SHORT: Record<WatchStatus, string> = {
  watched: "İzledim",
  watching: "İzliyorum",
  watchlist: "Listemde",
  dropped: "Yarım",
  not_watched: "İzlemedim",
  unsure: "Emin değilim",
};

const VISIBILITY_LABELS: Record<string, string> = {
  public: "Herkese açık",
  followers: "Takipçiler",
  private: "Gizli",
};

const REWATCH_LABELS: Record<string, string> = {
  yes: "Tekrar izlerim",
  maybe: "Belki",
  no: "Hayır",
};

/**
 * Birlestirilmis degerlendirme karti:
 *  - Kisisel hafiza (durum, puan, notlar, detaylar) - sadece sana
 *  - Herkese acik incelemen (ayni puan paylasilir)
 *  - Topluluk incelemeleri (baska kullanicilar)
 * Tek kart icinde, tek puan, tek kaydet.
 */
export function EvaluationCard({
  titleId,
  titleName,
  isSeries,
  entry,
  viewer,
  initialReviews,
}: {
  titleId: string;
  titleName: string;
  isSeries: boolean;
  entry: Entry;
  viewer: SpoilerViewer;
  initialReviews: ReviewItem[];
}) {
  const router = useRouter();
  const { addLibraryEntry, updateLibraryEntry, deleteLibraryEntry } =
    useOfflineQueue();

  const myReview = initialReviews.find((r) => r.authorId === viewer.userId);
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

  // Herkese acik inceleme
  const [reviewBody, setReviewBody] = useState(myReview?.body ?? "");
  const [visibility, setVisibility] = useState<
    "public" | "followers" | "private"
  >(myReview?.visibility ?? "public");
  const [containsSpoiler, setContainsSpoiler] = useState(
    myReview?.containsSpoiler ?? false
  );
  const [scopeSeason, setScopeSeason] = useState<string>(
    myReview?.spoilerScopeSeason != null ? String(myReview.spoilerScopeSeason) : ""
  );

  const [reviews, setReviews] = useState<ReviewItem[]>(initialReviews);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  /* ------------------------------------------------------ Kaydet */

  const saveLibrary = useCallback(async () => {
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
      progressEpisode:
        progressEpisode === "" ? null : Number(progressEpisode),
      isFavorite,
    };

    const response = await fetch("/api/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) throw new Error(data.error ?? "Kaydedilemedi.");
  }, [
    titleId,
    status,
    rating,
    notes,
    likedAspects,
    dislikedAspects,
    memorableScenes,
    watchedPeriod,
    rewatchIntent,
    progressSeason,
    progressEpisode,
    isFavorite,
  ]);

  const saveReview = useCallback(async () => {
    const trimmed = reviewBody.trim();
    if (!trimmed) {
      // Inceleme yoksa kayit edilmez (mevcut inceleme varsa silinmez)
      return;
    }
    const response = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titleId,
        body: trimmed,
        rating,
        containsSpoiler,
        spoilerScopeSeason:
          containsSpoiler && isSeries && scopeSeason ? Number(scopeSeason) : null,
        visibility,
      }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) throw new Error(data.error ?? "İnceleme kaydedilemedi.");

    const listResponse = await fetch(
      `/api/reviews?titleId=${encodeURIComponent(titleId)}`
    );
    if (listResponse.ok) {
      const list = (await listResponse.json()) as { items?: ReviewItem[] };
      if (list.items) setReviews(list.items);
    }
  }, [titleId, reviewBody, rating, containsSpoiler, isSeries, scopeSeason, visibility]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      if (!online) {
        if (entry) {
          await updateLibraryEntry(entry.id, {
            status,
            rating: rating ?? undefined,
            notes: notes.trim() || undefined,
            likedAspects: likedAspects.trim() || undefined,
            dislikedAspects: dislikedAspects.trim() || undefined,
            memorableScenes: memorableScenes.trim() || undefined,
            watchedPeriod: watchedPeriod.trim() || undefined,
          });
        } else {
          await addLibraryEntry(titleId, status, rating ?? undefined);
        }
        setMessage("Çevrimdışı — online olduğunda senklenecek.");
        return;
      }
      await saveLibrary();
      await saveReview();
      setMessage("Kaydedildi.");
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
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
    } catch (e: any) {
      setError(e.message ?? "Silinemedi.");
    } finally {
      setSaving(false);
    }
  };

  const communityReviews = reviews.filter((r) => r.authorId !== viewer.userId);
  const detailCount = [
    notes.trim(),
    likedAspects.trim(),
    dislikedAspects.trim(),
    memorableScenes.trim(),
    watchedPeriod.trim(),
    rewatchIntent,
  ].filter(Boolean).length;

  return (
    <section className="surface p-4 lg:col-span-2">
      {/* ---------------------------------------------- Baslik */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="section-title">Değerlendirmen</h2>
          <p className="muted mt-0.5 text-xs">
            {entry
              ? "Kayıtlı — puanın hem hafızanda hem incelemende geçerlidir."
              : "Bu yapımı değerlendirin — hafızanıza ekleyin."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsFavorite((v) => !v)}
            aria-pressed={isFavorite}
            aria-label={isFavorite ? "Favorilerden çıkar" : "Favorilere ekle"}
            className={`btn px-2 ${isFavorite ? "btn-primary" : "btn-ghost"}`}
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
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="btn btn-ghost"
            aria-expanded={expanded}
          >
            {expanded ? "Detayları gizle" : "Detay ekle"}
          </button>
        </div>
      </div>

      {/* ---------------------------------------------- Durum + puan */}
      <div className="mt-3 grid gap-3 md:grid-cols-[1.25fr_1fr]">
        <div>
          <span className="label">İzleme durumu</span>
          <div className="mt-1 flex flex-wrap gap-1">
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

        <div>
          <span className="label">
            Puanınız {rating ? `· ${rating}/10` : "· verilmedi"}
          </span>
          <div className="mt-1 flex flex-wrap gap-0.5">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(rating === value ? null : value)}
                aria-pressed={rating === value}
                aria-label={`${value} puan`}
                className={`h-6 w-6 rounded-md border text-[0.68rem] font-semibold transition-colors ${
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
      </div>

      {/* ---------------------------------------------- Not + inceleme */}
      <div className="mt-4 grid gap-4 md:grid-cols-2 md:divide-x md:divide-ink-700">
        {/* Kişisel not (özel) */}
        <div className="md:pr-4">
          <p className="label">Kişisel notun (yalnızca sana görünür)</p>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            maxLength={5000}
            className="field mt-1 resize-y"
            placeholder={`${titleName} hakkında kişisel düşüncelerin…`}
          />

          {expanded ? (
            <div className="mt-3 flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="watchedPeriod" className="label">
                    İzleme dönemi
                  </label>
                  <input
                    id="watchedPeriod"
                    type="text"
                    value={watchedPeriod}
                    onChange={(e) => setWatchedPeriod(e.target.value)}
                    placeholder="Örn. 2023 yazı"
                    className="field"
                  />
                </div>
                <div>
                  <label htmlFor="rewatch" className="label">
                    Yeniden izleme
                  </label>
                  <select
                    id="rewatch"
                    value={rewatchIntent}
                    onChange={(e) =>
                      setRewatchIntent(e.target.value as "yes" | "maybe" | "no" | "")
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
                      Son sezon
                    </label>
                    <input
                      id="progressSeason"
                      type="number"
                      min={0}
                      max={200}
                      value={progressSeason}
                      onChange={(e) =>
                        setProgressSeason(
                          e.target.value === "" ? "" : Number(e.target.value)
                        )
                      }
                      className="field"
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
                      onChange={(e) =>
                        setProgressEpisode(
                          e.target.value === "" ? "" : Number(e.target.value)
                        )
                      }
                      className="field"
                    />
                  </div>
                </div>
              ) : null}

              <div>
                <label htmlFor="liked" className="label">
                  Beğendiğin yönler
                </label>
                <input
                  id="liked"
                  type="text"
                  value={likedAspects}
                  onChange={(e) => setLikedAspects(e.target.value)}
                  placeholder="Örn. atmosfer, diyaloglar"
                  className="field"
                />
              </div>
              <div>
                <label htmlFor="disliked" className="label">
                  Beğenmediğin yönler
                </label>
                <input
                  id="disliked"
                  type="text"
                  value={dislikedAspects}
                  onChange={(e) => setDislikedAspects(e.target.value)}
                  placeholder="Örn. tempo, final"
                  className="field"
                />
              </div>
              <div>
                <label htmlFor="scenes" className="label">
                  Hatırladığın sahneler / temalar
                </label>
                <textarea
                  id="scenes"
                  value={memorableScenes}
                  onChange={(e) => setMemorableScenes(e.target.value)}
                  rows={2}
                  maxLength={2000}
                  className="field resize-y"
                />
              </div>
            </div>
          ) : detailCount > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {watchedPeriod && (
                <span className="chip text-[0.65rem]">{watchedPeriod}</span>
              )}
              {rewatchIntent && (
                <span className="chip text-[0.65rem]">
                  {REWATCH_LABELS[rewatchIntent]}
                </span>
              )}
              {isSeries && progressSeason != null && (
                <span className="chip text-[0.65rem]">
                  {progressSeason}. sezon
                  {progressEpisode != null
                    ? ` · ${progressEpisode}. bölüm`
                    : ""}
                </span>
              )}
              {likedAspects && (
                <span className="chip text-[0.65rem]">♥ {likedAspects}</span>
              )}
              {dislikedAspects && (
                <span className="chip text-[0.65rem]">✕ {dislikedAspects}</span>
              )}
              {memorableScenes && (
                <span className="chip text-[0.65rem]">
                  ★ {memorableScenes}
                </span>
              )}
            </div>
          ) : null}
        </div>

        {/* Herkese açık inceleme */}
        <div className="md:pl-4">
          <p className="label">Herkese açık incelemen</p>
          <textarea
            id="review-body"
            value={reviewBody}
            onChange={(e) => setReviewBody(e.target.value)}
            rows={4}
            maxLength={10000}
            className="field mt-1 resize-y"
            placeholder={`${titleName} hakkında ne düşündün? (isteğe bağlı)`}
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <select
              id="review-visibility"
              value={visibility}
              onChange={(e) =>
                setVisibility(
                  e.target.value as "public" | "followers" | "private"
                )
              }
              className="field w-auto text-sm"
            >
              <option value="public">Herkese açık</option>
              <option value="followers">Takipçiler</option>
              <option value="private">Gizli</option>
            </select>
            <label className="flex items-center gap-1.5 text-xs text-mist-400">
              <input
                type="checkbox"
                checked={containsSpoiler}
                onChange={(e) => setContainsSpoiler(e.target.checked)}
                className="accent-gold-500"
              />
              Spoiler içeriyor
            </label>
            {containsSpoiler && isSeries ? (
              <input
                type="number"
                min={0}
                max={100}
                value={scopeSeason}
                onChange={(e) => setScopeSeason(e.target.value)}
                placeholder="Sezon no"
                className="field w-24 text-sm"
                aria-label="Spoiler sezonu"
              />
            ) : null}
          </div>
          <p className="mt-1.5 text-[0.65rem] text-mist-500">
            Puanın yukarıdan paylaşılır — hem hafızan hem incelemen aynı
            puanı kullanır.
          </p>
        </div>
      </div>

      {/* ---------------------------------------------- Aksiyonlar */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary"
        >
          {saving ? "Kaydediliyor…" : entry ? "Kaydet" : "Kütüphaneye ekle"}
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
          {titleName} · kişisel notlar yalnızca size görünür
        </span>
      </div>

      {!online && (
        <p className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Çevrimdışısınız — değişiklikler online olduğunda senklenecek.
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-400"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="mt-2 rounded-lg border border-jade-500/40 bg-jade-500/10 px-3 py-2 text-sm text-jade-400"
        >
          {message}
        </p>
      )}

      {/* ---------------------------------------------- Topluluk incelemeleri */}
      <div className="mt-5 border-t border-ink-700 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-mist-100">
            Topluluk incelemeleri
          </h3>
          <span className="chip">{communityReviews.length} inceleme</span>
        </div>

        {communityReviews.length === 0 ? (
          <p className="muted mt-2 text-sm">
            Başka kullanıcılar henüz inceleme yazmamış. Senin incelemeni
            yazmakla başlayabilirsin.
          </p>
        ) : (
          <ul className="mt-3 flex max-h-[380px] flex-col divide-y divide-ink-700 overflow-y-auto pr-1">
            {communityReviews.map((review) => (
              <li key={review.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-mist-500">
                  <span className="font-medium text-mist-200">
                    {review.authorName}
                  </span>
                  {review.rating ? (
                    <span className="chip chip-gold">{review.rating}/10</span>
                  ) : null}
                  <span className="chip">
                    {VISIBILITY_LABELS[review.visibility]}
                  </span>
                  <span>
                    {new Date(review.createdAt).toLocaleDateString("tr-TR")}
                  </span>
                  <ReportButton targetType="review" targetId={review.id} />
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm text-mist-300">
                  {review.body}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
