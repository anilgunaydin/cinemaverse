"use client";

import Link from "next/link";
import { useState } from "react";

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
}: {
  threads: ThreadListItem[];
  viewer: SpoilerViewer;
  viewerId: string | null;
  isLoggedIn: boolean;
  titleId?: string | null;
  titleName?: string | null;
  showCreate?: boolean;
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
    } catch {
      setError("Ağ hatası: tartışma açılamadı.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="section-title">Tartışmalar</h2>
        <span className="chip">{threads.length} konu</span>
      </div>

      {showCreate ? (
        isLoggedIn ? (
          <div className="mt-3 flex flex-col gap-2 rounded-lg border border-ink-700 bg-ink-900/60 p-3">
            <label className="label" htmlFor="thread-heading">
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
            <textarea
              id="thread-body"
              className="field min-h-[90px]"
              value={body}
              maxLength={20000}
              placeholder="Düşüncenizi yazın…"
              onChange={(event) => setBody(event.target.value)}
            />
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="label" htmlFor="thread-visibility">
                  Görünürlük
                </label>
                <select
                  id="thread-visibility"
                  className="field"
                  value={visibility}
                  onChange={(event) =>
                    setVisibility(
                      event.target.value as ThreadListItem["visibility"],
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
              <label className="flex items-center gap-2 pb-2 text-xs text-mist-400">
                <input
                  type="checkbox"
                  checked={containsSpoiler}
                  onChange={(event) => setContainsSpoiler(event.target.checked)}
                />
                Spoiler içeriyor
              </label>
            </div>
            <p className="text-[0.7rem] text-mist-500">
              &ldquo;Takipçilerim&rdquo; görünürlüğü, takip sistemi eklenene kadar
              kullanılamaz.
            </p>
            <button
              type="button"
              className="btn btn-primary self-start"
              onClick={submit}
              disabled={busy || heading.trim().length < 3 || body.trim().length === 0}
            >
              {busy ? "Açılıyor…" : "Tartışma aç"}
            </button>
            {error ? (
              <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
                {error}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="muted mt-2">Tartışma açmak için giriş yapın.</p>
        )
      ) : null}

      {threads.length === 0 ? (
        <p className="muted mt-4">
          {titleName
            ? `Bu yapım için henüz tartışma yok. İlk konuyu siz açabilirsiniz.`
            : "Henüz tartışma yok. İlk konuyu siz açabilirsiniz."}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col divide-y divide-ink-700">
          {threads.map((thread) => {
            const state = spoilerState(viewer, {
              containsSpoiler: thread.containsSpoiler,
              scopeSeason: null,
            });
            const isOpen = state === "visible" || revealed.has(thread.id);
            return (
              <li key={thread.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-mist-500">
                  <span className="font-medium text-mist-200">
                    {thread.authorName}
                  </span>
                  {thread.titleId ? (
                    <Link
                      href={`/title/${thread.titleId}`}
                      className="text-gold-400 hover:underline"
                    >
                      {thread.titleName}
                      {thread.titleReleaseYear ? ` (${thread.titleReleaseYear})` : ""}
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
                  <span>
                    {new Date(thread.lastActivityAt).toLocaleDateString("tr-TR")}
                  </span>
                </div>

                <Link
                  href={`/discussions/${thread.id}`}
                  className="mt-1.5 block font-display text-base font-semibold text-mist-100 hover:text-gold-300"
                >
                  {thread.heading}
                </Link>

                {isOpen ? (
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-mist-400">
                    {thread.body}
                  </p>
                ) : (
                  <div className="mt-1.5 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2">
                    <p className="text-xs text-rose-400">
                      Bu konu spoiler içeriyor ve gizlendi.
                    </p>
                    <button
                      type="button"
                      className="mt-1 text-xs text-gold-400 hover:underline"
                      onClick={() =>
                        setRevealed((previous) => new Set(previous).add(thread.id))
                      }
                    >
                      Yine de göster
                    </button>
                  </div>
                )}
                {viewerId === thread.authorId ? (
                  <p className="mt-1 text-[0.7rem] text-mist-500">Sizin konunuz</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
