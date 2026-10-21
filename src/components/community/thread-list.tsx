"use client";

import Link from "next/link";
import { useState } from "react";

import { DetailCard } from "@/components/catalog/detail-card";
import { spoilerState, type SpoilerViewer } from "@/lib/spoilers/rules";

export type ThreadListItem = {
  id: string;
  titleId: string | null;
  titleName: string | null;
  titleReleaseYear: number | null;
  authorId: string;
  authorName: string;
  heading: string;
  body: string;
  containsSpoiler: boolean;
  visibility: "private" | "followers" | "public";
  createdAt: string;
  updatedAt: string;
  postCount: number;
  lastActivityAt: string;
};

const VISIBILITY_OPTIONS: Array<{
  value: ThreadListItem["visibility"];
  label: string;
}> = [
  { value: "public", label: "Herkese açık" },
  { value: "private", label: "Yalnızca ben" },
];

export function ThreadList({
  threads: initialThreads,
  viewer,
  viewerId,
  isLoggedIn,
  titleId = null,
  titleName = null,
  showCreate = true,
  className = "",
}: {
  threads: ThreadListItem[];
  viewer: SpoilerViewer;
  viewerId: string | null;
  isLoggedIn: boolean;
  titleId?: string | null;
  titleName?: string | null;
  showCreate?: boolean;
  className?: string;
}) {
  const [threads, setThreads] = useState<ThreadListItem[]>(initialThreads);
  const [heading, setHeading] = useState("");
  const [body, setBody] = useState("");
  const [containsSpoiler, setContainsSpoiler] = useState(false);
  const [visibility, setVisibility] =
    useState<ThreadListItem["visibility"]>("public");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [composing, setComposing] = useState(false);

  async function refresh() {
    const query = titleId ? `?titleId=${encodeURIComponent(titleId)}` : "";
    const response = await fetch(`/api/discussions${query}`);
    if (response.ok) {
      const data = (await response.json()) as { items: ThreadListItem[] };
      setThreads(data.items);
    }
  }

  async function submit() {
    if (heading.trim().length < 3 || body.trim().length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/discussions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titleId,
          heading: heading.trim(),
          body: body.trim(),
          containsSpoiler,
          visibility,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Tartışma açılamadı.");
        return;
      }
      await refresh();
      setHeading("");
      setBody("");
      setContainsSpoiler(false);
      setComposing(false);
    } catch {
      setError("Ağ hatası: tartışma açılamadı.");
    } finally {
      setBusy(false);
    }
  }

  const canCreate = showCreate && isLoggedIn;

  return (
    <DetailCard
      icon="thread"
      title="Tartışmalar"
      meta={`${threads.length} konu`}
      className={className}
      action={
        canCreate ? (
          <button
            type="button"
            onClick={() => setComposing((value) => !value)}
            aria-expanded={composing}
            className={`chip transition-colors ${
              composing
                ? "chip-gold"
                : "hover:border-gold-500/40 hover:text-gold-300"
            }`}
          >
            {composing ? "Vazgeç" : "+ Yeni konu"}
          </button>
        ) : null
      }
    >
      {showCreate && !isLoggedIn ? (
        <p className="mb-2 text-xs text-mist-400">
          Tartışma açmak için giriş yapın.
        </p>
      ) : null}

      {canCreate && composing ? (
        <div className="mb-3 flex shrink-0 flex-col gap-2 rounded-xl border border-ink-700 bg-ink-900/60 p-3">
          <label className="sr-only" htmlFor="thread-heading">
            Yeni konu başlığı
          </label>
          <input
            id="thread-heading"
            className="field"
            value={heading}
            maxLength={200}
            placeholder={
              titleName
                ? `${titleName} hakkında bir tartışma başlatın`
                : "Bir film veya dizi hakkında tartışma başlatın"
            }
            onChange={(event) => setHeading(event.target.value)}
          />
          <label className="sr-only" htmlFor="thread-body">
            Konu metni
          </label>
          <textarea
            id="thread-body"
            className="field min-h-[76px]"
            value={body}
            maxLength={20000}
            placeholder="Düşüncenizi yazın…"
            onChange={(event) => setBody(event.target.value)}
          />
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0">
              <label className="label" htmlFor="thread-visibility">
                Görünürlük
              </label>
              <select
                id="thread-visibility"
                className="field w-auto text-sm"
                value={visibility}
                onChange={(event) =>
                  setVisibility(
                    event.target.value as ThreadListItem["visibility"]
                  )
                }
              >
                {VISIBILITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-1.5 pb-2 text-xs text-mist-400">
              <input
                type="checkbox"
                checked={containsSpoiler}
                onChange={(event) => setContainsSpoiler(event.target.checked)}
                className="accent-gold-500"
              />
              Spoiler
            </label>
            <button
              type="button"
              className="btn btn-primary ml-auto text-xs"
              onClick={submit}
              disabled={
                busy || heading.trim().length < 3 || body.trim().length === 0
              }
            >
              {busy ? "Açılıyor…" : "Aç"}
            </button>
          </div>
          {error ? (
            <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}

      {threads.length === 0 ? (
        <div className="flex min-h-[120px] flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-ink-700 px-4 py-6 text-center">
          <p className="text-sm text-mist-400">
            {titleName
              ? "Bu yapım için henüz tartışma yok."
              : "Henüz tartışma yok."}
          </p>
          {canCreate && !composing ? (
            <button
              type="button"
              onClick={() => setComposing(true)}
              className="btn btn-ghost text-xs"
            >
              + İlk konuyu aç
            </button>
          ) : null}
        </div>
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-ink-700/70 overflow-y-auto pr-1">
          {threads.map((thread) => {
            const state = spoilerState(viewer, {
              containsSpoiler: thread.containsSpoiler,
              scopeSeason: null,
            });
            const isOpen = state === "visible" || revealed.has(thread.id);
            return (
              <li key={thread.id} className="py-2.5 first:pt-0">
                <div className="flex flex-wrap items-center gap-1.5 text-[0.68rem] text-mist-500">
                  <span className="font-medium text-mist-200">
                    {thread.authorName}
                  </span>
                  {thread.titleId ? (
                    <Link
                      href={`/title/${thread.titleId}`}
                      className="truncate text-gold-400 hover:underline"
                    >
                      {thread.titleName}
                      {thread.titleReleaseYear
                        ? ` (${thread.titleReleaseYear})`
                        : ""}
                    </Link>
                  ) : (
                    <span className="chip">Genel</span>
                  )}
                  <span className="chip">{thread.postCount} yanıt</span>
                  {thread.visibility !== "public" ? (
                    <span className="chip">
                      {thread.visibility === "private"
                        ? "Yalnızca ben"
                        : "Takipçilerim"}
                    </span>
                  ) : null}
                  {thread.containsSpoiler ? (
                    <span className="chip chip-rose">Spoiler</span>
                  ) : null}
                  <span className="ml-auto shrink-0">
                    {new Date(thread.lastActivityAt).toLocaleDateString("tr-TR")}
                  </span>
                </div>

                <Link
                  href={`/discussions/${thread.id}`}
                  className="mt-1 block truncate font-display text-[0.95rem] font-semibold text-mist-100 hover:text-gold-300"
                >
                  {thread.heading}
                </Link>

                {isOpen ? (
                  <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-[0.8rem] leading-relaxed text-mist-400">
                    {thread.body}
                  </p>
                ) : (
                  <div className="mt-1 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-1.5">
                    <p className="text-xs text-rose-400">
                      Bu konu spoiler içeriyor ve gizlendi.
                    </p>
                    <button
                      type="button"
                      className="text-xs text-gold-400 hover:underline"
                      onClick={() =>
                        setRevealed((previous) =>
                          new Set(previous).add(thread.id)
                        )
                      }
                    >
                      Yine de göster
                    </button>
                  </div>
                )}
                {viewerId === thread.authorId ? (
                  <p className="mt-0.5 text-[0.68rem] text-mist-500">
                    Sizin konunuz
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </DetailCard>
  );
}
