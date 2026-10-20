"use client";

import { useState } from "react";

import { spoilerState, type SpoilerViewer } from "@/lib/spoilers/rules";
import { ReportButton } from "@/components/community/report-button";

export type ReviewItem = {
  id: string;
  titleId: string;
  titleName: string;
  releaseYear: number | null;
  authorId: string;
  authorName: string;
  body: string;
  rating: number | null;
  containsSpoiler: boolean;
  spoilerScopeSeason: number | null;
  visibility: "private" | "followers" | "public";
  createdAt: string;
  updatedAt: string;
};

const VISIBILITY_LABELS: Record<ReviewItem["visibility"], string> = {
  private: "Yalnızca ben",
  followers: "Takipçilerim",
  public: "Herkese açık",
};

export function ReviewPanel({
  titleId,
  titleName,
  isSeries,
  isLoggedIn,
  viewerId,
  viewer,
  initialReviews,
}: {
  titleId: string;
  titleName: string;
  isSeries: boolean;
  isLoggedIn: boolean;
  viewerId: string | null;
  viewer: SpoilerViewer;
  initialReviews: ReviewItem[];
}) {
  const [reviews, setReviews] = useState<ReviewItem[]>(initialReviews);
  const [body, setBody] = useState("");
  const [rating, setRating] = useState<string>("");
  const [containsSpoiler, setContainsSpoiler] = useState(false);
  const [scopeSeason, setScopeSeason] = useState<string>("");
  const [visibility, setVisibility] =
    useState<ReviewItem["visibility"]>("public");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const myReview = reviews.find((review) => review.authorId === viewerId);

  async function submit() {
    if (body.trim().length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titleId,
          body: body.trim(),
          rating: rating ? Number(rating) : null,
          containsSpoiler,
          spoilerScopeSeason:
            containsSpoiler && isSeries && scopeSeason ? Number(scopeSeason) : null,
          visibility,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "İnceleme kaydedilemedi.");
        return;
      }
      // Sunucudan guncel listeyi cek.
      const listResponse = await fetch(
        `/api/reviews?titleId=${encodeURIComponent(titleId)}`,
      );
      if (listResponse.ok) {
        const listData = (await listResponse.json()) as { items: ReviewItem[] };
        setReviews(listData.items);
      }
      setBody("");
      setRating("");
      setContainsSpoiler(false);
      setScopeSeason("");
    } catch {
      setError("Ağ hatası: inceleme kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="section-title">İncelemeler</h2>
        <span className="chip">{reviews.length} inceleme</span>
      </div>

      {isLoggedIn ? (
        <div className="mt-3 flex flex-col gap-2 rounded-lg border border-ink-700 bg-ink-900/60 p-3">
          <label className="label" htmlFor="review-body">
            {myReview ? "İncelemenizi güncelleyin" : "İncelemenizi yazın"}
          </label>
          <textarea
            id="review-body"
            className="field min-h-[90px]"
            value={body}
            maxLength={10000}
            placeholder={`${titleName} hakkında düşünceleriniz…`}
            onChange={(event) => setBody(event.target.value)}
          />
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label" htmlFor="review-rating">
                Puanınız (opsiyonel, 1-10)
              </label>
              <input
                id="review-rating"
                type="number"
                min={1}
                max={10}
                className="field w-24"
                value={rating}
                onChange={(event) => setRating(event.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="review-visibility">
                Görünürlük
              </label>
              <select
                id="review-visibility"
                className="field"
                value={visibility}
                onChange={(event) =>
                  setVisibility(event.target.value as ReviewItem["visibility"])
                }
              >
                {Object.entries(VISIBILITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 pb-2 text-xs text-mist-400">
              <input
                type="checkbox"
                checked={containsSpoiler}
                onChange={(event) => setContainsSpoiler(event.target.checked)}
              />
              Spoiler içeriyor
            </label>
            {containsSpoiler && isSeries ? (
              <div className="pb-1">
                <label className="label" htmlFor="review-scope">
                  Hangi sezona kadar?
                </label>
                <input
                  id="review-scope"
                  type="number"
                  min={1}
                  max={100}
                  className="field w-24"
                  value={scopeSeason}
                  onChange={(event) => setScopeSeason(event.target.value)}
                />
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="btn btn-primary self-start"
            onClick={submit}
            disabled={busy || body.trim().length === 0}
          >
            {busy ? "Kaydediliyor…" : myReview ? "Güncelle" : "İncelemeyi yayınla"}
          </button>
          {error ? (
            <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="muted mt-2">İnceleme yazmak için giriş yapın.</p>
      )}

      {reviews.length === 0 ? (
        <p className="muted mt-4">
          Bu yapım için henüz inceleme yok. İlk incelemeyi siz yazabilirsiniz.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col divide-y divide-ink-700">
          {reviews.map((review) => {
            const state = spoilerState(viewer, {
              containsSpoiler: review.containsSpoiler,
              scopeSeason: review.spoilerScopeSeason,
            });
            const isOpen = state === "visible" || revealed.has(review.id);
            return (
              <li key={review.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-mist-500">
                  <span className="font-medium text-mist-200">
                    {review.authorName}
                  </span>
                  {review.rating ? (
                    <span className="chip chip-gold">{review.rating}/10</span>
                  ) : null}
                  <span className="chip">{VISIBILITY_LABELS[review.visibility]}</span>
                  <span>{new Date(review.createdAt).toLocaleDateString("tr-TR")}</span>
                  {viewerId && viewerId !== review.authorId ? (
                    <ReportButton
                      targetType="review"
                      targetId={review.id}
                    />
                  ) : null}
                </div>
                {isOpen ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-mist-300">
                    {review.body}
                  </p>
                ) : (
                  <div className="mt-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2">
                    <p className="text-xs text-rose-400">
                      Bu inceleme spoiler içeriyor
                      {review.spoilerScopeSeason
                        ? ` (${review.spoilerScopeSeason}. sezona kadar)`
                        : ""}{" "}
                      ve izleme ilerlemenize göre gizlendi.
                    </p>
                    <button
                      type="button"
                      className="mt-1 text-xs text-gold-400 hover:underline"
                      onClick={() =>
                        setRevealed((previous) => new Set(previous).add(review.id))
                      }
                    >
                      Yine de göster
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
