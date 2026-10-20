"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

import HoverTrailer from "@/components/catalog/hover-trailer";

export type FranchiseTitleView = {
  id: string;
  titleId: string;
  titleName: string;
  originalTitle: string;
  releaseYear: number | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  trailerUrl: string | null;
  kind: string;
  order: number | null;
};

export type FranchiseDetailView = {
  id: string;
  name: string;
  wikidataId: string | null;
  createdAt: string;
  titleCount: number;
  titles: FranchiseTitleView[];
};

const KIND_LABELS: Record<string, string> = {
  movie: "Film",
  series: "Dizi",
  season: "Sezon",
  episode: "Bölüm",
};

export function FranchiseDetail({
  franchise: initialFranchise,
  isModerator,
}: {
  franchise: FranchiseDetailView;
  isModerator: boolean;
}) {
  const router = useRouter();
  const [franchise, setFranchise] = useState<FranchiseDetailView>(initialFranchise);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialFranchise.name);
  const [wikidataId, setWikidataId] = useState(initialFranchise.wikidataId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddTitle, setShowAddTitle] = useState(false);
  const [addTitleId, setAddTitleId] = useState("");

  async function refresh() {
    const response = await fetch(`/api/franchises/${franchise.id}`);
    if (response.ok) {
      const data = (await response.json()) as { franchise: FranchiseDetailView };
      setFranchise(data.franchise);
    }
  }

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/franchises/${franchise.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, wikidataId: wikidataId.trim() || null }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Franchise güncellenemedi.");
        return;
      }
      setEditing(false);
      await refresh();
    } catch {
      setError("Ağ hatası: franchise güncellenemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Bu franchise&apos;i ve tüm bağlantılarını silmek istediğinize emin misiniz?"))
      return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/franchises/${franchise.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "Franchise silinemedi.");
        return;
      }
      router.push("/franchises");
      router.refresh();
    } catch {
      setError("Ağ hatası: franchise silinemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddTitle() {
    if (!addTitleId.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/franchises/${franchise.id}/titles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleId: addTitleId.trim() }),
      });
      const data = (await response.json()) as { error?: string; code?: string };
      if (!response.ok) {
        setError(data.error ?? "Yapım eklenemedi.");
        return;
      }
      setAddTitleId("");
      setShowAddTitle(false);
      await refresh();
    } catch {
      setError("Ağ hatası: yapım eklenemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveTitle(titleId: string) {
    if (!window.confirm("Bu yapımı franchise'den kaldırmak istediğinize emin misiniz?")) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/franchises/${franchise.id}/titles/${encodeURIComponent(titleId)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "Yapım kaldırılamadı.");
        return;
      }
      await refresh();
    } catch {
      setError("Ağ hatası: yapım kaldırılamadı.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-[200px]">
          {editing ? (
            <div className="flex flex-col gap-2">
              <input
                className="field font-display text-xl"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={200}
              />
              <input
                className="field"
                value={wikidataId}
                onChange={(e) => setWikidataId(e.target.value)}
                placeholder="Q123456"
                maxLength={50}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={busy || name.trim().length === 0}
                >
                  {busy ? "Kaydediliyor…" : "Kaydet"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setName(franchise.name);
                    setWikidataId(franchise.wikidataId ?? "");
                    setEditing(false);
                  }}
                  disabled={busy}
                >
                  İptal
                </button>
              </div>
            </div>
          ) : (
            <>
              <h2 className="font-display text-2xl font-semibold">{franchise.name}</h2>
              {franchise.wikidataId ? (
                <a
                  href={`https://www.wikidata.org/wiki/${franchise.wikidataId}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-1 text-sm text-gold-400 hover:underline"
                >
                  Wikidata: {franchise.wikidataId}
                </a>
              ) : null}
            </>
          )}
        </div>

        {isModerator ? (
          <div className="flex flex-col gap-2 shrink-0">
            {!editing ? (
              <>
                <button
                  type="button"
                  className="btn btn-ghost text-sm"
                  onClick={() => setEditing(true)}
                >
                  Düzenle
                </button>
                <button
                  type="button"
                  className="btn btn-ghost text-sm text-rose-400 hover:bg-rose-500/10"
                  onClick={handleDelete}
                  disabled={busy}
                >
                  Sil
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-ghost text-sm"
                onClick={() => setEditing(false)}
                disabled={busy}
              >
                İptal
              </button>
            )}
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
          {error}
        </div>
      ) : null}

      {franchise.titles.length === 0 ? (
        <div className="mt-6 text-center py-8">
          <p className="muted">Bu franchise&apos;de henüz yapım yok.</p>
          {isModerator && (
            <p className="text-xs text-mist-500 mt-2">
              Yukarıdan &ldquo;Yapım ekle&rdquo; ile ekleyebilirsiniz.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-4">
          {isModerator && !showAddTitle && (
            <button
              type="button"
              className="btn btn-primary text-sm mb-3"
              onClick={() => setShowAddTitle(true)}
            >
              Yapım ekle
            </button>
          )}

          {showAddTitle && (
            <div className="mb-3 flex gap-2">
              <input
                type="text"
                className="field flex-1 text-sm"
                value={addTitleId}
                onChange={(e) => setAddTitleId(e.target.value)}
                placeholder="Yapım ID (örn: ttl_...)"
                onKeyDown={(e) => e.key === "Enter" && handleAddTitle()}
              />
              <button
                type="button"
                className="btn btn-primary text-sm"
                onClick={handleAddTitle}
                disabled={busy || !addTitleId.trim()}
              >
                Ekle
              </button>
              <button
                type="button"
                className="btn btn-ghost text-sm"
                onClick={() => setShowAddTitle(false)}
                disabled={busy}
              >
                İptal
              </button>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {franchise.titles.map((title) => (
              <Link
                key={title.id}
                href={`/title/${title.titleId}`}
                className="surface group flex flex-col h-full transition-colors hover:border-gold-500/30"
              >
                <div className="relative aspect-video w-full overflow-hidden rounded-t-xl">
                  {title.trailerUrl ? (
                    <HoverTrailer
                      trailerUrl={title.trailerUrl}
                      linkHref={`/title/${title.titleId}`}
                      metaTitle={title.titleName}
                      metaSubtitle={
                        [
                          title.releaseYear?.toString(),
                          KIND_LABELS[title.kind] ?? title.kind,
                        ]
                          .filter(Boolean)
                          .join(" · ") || null
                      }
                    />
                  ) : null}
                  {(title.backdropUrl ?? title.posterUrl) ? (
                    <Image
                      src={(title.backdropUrl ?? title.posterUrl) as string}
                      alt={`${title.titleName} görseli`}
                      fill
                      className="object-cover"
                      sizes="320px"
                      unoptimized
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-mist-500 text-xs">
                      Görsel yok
                    </div>
                  )}
                </div>
                <div className="flex-1 p-2 flex flex-col">
                  <div className="flex items-center gap-1.5 text-xs text-mist-500">
                    <span className="chip text-[0.6rem]">{title.order ?? "#"}</span>
                    <span className="chip text-[0.6rem]">{KIND_LABELS[title.kind] ?? title.kind}</span>
                    {title.releaseYear ? (
                      <span className="text-mist-400">({title.releaseYear})</span>
                    ) : null}
                  </div>
                  <h3 className="mt-1 font-medium text-mist-100 line-clamp-1 flex-1 group-hover:text-gold-300">
                    {title.titleName}
                  </h3>
                  {title.originalTitle !== title.titleName ? (
                    <p className="text-xs text-mist-500 truncate">{title.originalTitle}</p>
                  ) : null}

                  {isModerator && (
                    <button
                      type="button"
                      className="btn btn-ghost mt-2 w-full justify-start text-xs px-2 py-1 text-rose-400 hover:bg-rose-500/10"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRemoveTitle(title.titleId);
                      }}
                      disabled={busy}
                    >
                      Kaldır
                    </button>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}