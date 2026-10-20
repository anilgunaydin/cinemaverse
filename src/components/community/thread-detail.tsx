"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { spoilerState, type SpoilerViewer } from "@/lib/spoilers/rules";
import { ReportButton } from "@/components/community/report-button";

export type ThreadPostItem = {
  id: string;
  threadId: string;
  authorId: string;
  authorName: string;
  body: string;
  containsSpoiler: boolean;
  createdAt: string;
};

export type ThreadDetailItem = {
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
  posts: ThreadPostItem[];
};

const VISIBILITY_LABELS: Record<ThreadDetailItem["visibility"], string> = {
  private: "Yalnızca ben",
  followers: "Takipçilerim",
  public: "Herkese açık",
};

export function ThreadDetail({
  thread: initialThread,
  viewer,
  viewerId,
  isLoggedIn,
}: {
  thread: ThreadDetailItem;
  viewer: SpoilerViewer;
  viewerId: string | null;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [thread, setThread] = useState<ThreadDetailItem>(initialThread);
  const [reply, setReply] = useState("");
  const [replySpoiler, setReplySpoiler] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  async function refresh() {
    const response = await fetch(`/api/discussions/${thread.id}`);
    if (response.ok) {
      const data = (await response.json()) as { thread: ThreadDetailItem };
      setThread(data.thread);
    }
  }

  async function submitReply() {
    if (reply.trim().length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/discussions/${thread.id}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: reply.trim(),
          containsSpoiler: replySpoiler,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Yanıt gönderilemedi.");
        return;
      }
      await refresh();
      setReply("");
      setReplySpoiler(false);
    } catch {
      setError("Ağ hatası: yanıt gönderilemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteThread() {
    if (!window.confirm("Bu konuyu ve tüm yanıtlarını silmek istediğinize emin misiniz?")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/discussions/${thread.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "Konu silinemedi.");
        return;
      }
      router.push("/discussions");
      router.refresh();
    } catch {
      setError("Ağ hatası: konu silinemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function deletePost(postId: string) {
    if (!window.confirm("Bu yanıtı silmek istediğinize emin misiniz?")) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/discussions/${thread.id}/posts/${postId}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "Yanıt silinemedi.");
        return;
      }
      await refresh();
    } catch {
      setError("Ağ hatası: yanıt silinemedi.");
    } finally {
      setBusy(false);
    }
  }

  const threadState = spoilerState(viewer, {
    containsSpoiler: thread.containsSpoiler,
    scopeSeason: null,
  });
  const threadOpen = threadState === "visible" || revealed.has("thread");

  return (
    <section className="surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs text-mist-500">
        <span className="font-medium text-mist-200">{thread.authorName}</span>
        {thread.titleId ? (
          <Link
            href={`/title/${thread.titleId}`}
            className="text-gold-400 hover:underline"
          >
            {thread.titleName}
            {thread.titleReleaseYear ? ` (${thread.titleReleaseYear})` : ""}
          </Link>
        ) : (
          <span className="chip">Genel tartışma</span>
        )}
        <span className="chip">{VISIBILITY_LABELS[thread.visibility]}</span>
        {thread.containsSpoiler ? (
          <span className="chip chip-rose">Spoiler</span>
        ) : null}
        <span>{new Date(thread.createdAt).toLocaleDateString("tr-TR")}</span>
        {viewerId === thread.authorId ? (
          <span className="text-gold-400">Sizin konunuz</span>
        ) : null}
        {viewerId && viewerId !== thread.authorId ? (
          <ReportButton targetType="thread" targetId={thread.id} />
        ) : null}
      </div>

      <h1 className="mt-2 font-display text-2xl font-semibold leading-tight">
        {thread.heading}
      </h1>

      {threadOpen ? (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-mist-300">
          {thread.body}
        </p>
      ) : (
        <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2">
          <p className="text-xs text-rose-400">
            Bu konu spoiler içeriyor ve gizlendi.
          </p>
          <button
            type="button"
            className="mt-1 text-xs text-gold-400 hover:underline"
            onClick={() => setRevealed((previous) => new Set(previous).add("thread"))}
          >
            Yine de göster
          </button>
        </div>
      )}

      {isLoggedIn && viewerId === thread.authorId ? (
        <button
          type="button"
          className="btn btn-ghost mt-3 px-2.5 text-xs"
          onClick={deleteThread}
          disabled={busy}
        >
          Konuyu sil
        </button>
      ) : null}

      <div className="mt-5 border-t border-ink-700 pt-4">
        <h2 className="section-title text-base">
          Yanıtlar ({thread.posts.length})
        </h2>

        {thread.posts.length === 0 ? (
          <p className="muted mt-2">Henüz yanıt yok.</p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-ink-700">
            {thread.posts.map((post) => {
              const state = spoilerState(viewer, {
                containsSpoiler: post.containsSpoiler,
                scopeSeason: null,
              });
              const isOpen = state === "visible" || revealed.has(post.id);
              return (
                <li key={post.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-mist-500">
                    <span className="font-medium text-mist-200">
                      {post.authorName}
                    </span>
                    {post.containsSpoiler ? (
                      <span className="chip chip-rose">Spoiler</span>
                    ) : null}
                    <span>
                      {new Date(post.createdAt).toLocaleDateString("tr-TR")}
                    </span>
                    {viewerId === post.authorId ? (
                      <button
                        type="button"
                        className="text-rose-400 hover:underline"
                        onClick={() => deletePost(post.id)}
                        disabled={busy}
                      >
                        Sil
                      </button>
                    ) : null}
                    {viewerId && viewerId !== post.authorId ? (
                      <ReportButton targetType="post" targetId={post.id} />
                    ) : null}
                  </div>
                  {isOpen ? (
                    <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-mist-300">
                      {post.body}
                    </p>
                  ) : (
                    <div className="mt-1.5 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2">
                      <p className="text-xs text-rose-400">
                        Bu yanıt spoiler içeriyor ve gizlendi.
                      </p>
                      <button
                        type="button"
                        className="mt-1 text-xs text-gold-400 hover:underline"
                        onClick={() =>
                          setRevealed((previous) => new Set(previous).add(post.id))
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

        {isLoggedIn ? (
          <div className="mt-4 flex flex-col gap-2 rounded-lg border border-ink-700 bg-ink-900/60 p-3">
            <label className="label" htmlFor="reply-body">
              Yanıtınız
            </label>
            <textarea
              id="reply-body"
              className="field min-h-[80px]"
              value={reply}
              maxLength={20000}
              placeholder="Yanıtınızı yazın…"
              onChange={(event) => setReply(event.target.value)}
            />
            <label className="flex items-center gap-2 text-xs text-mist-400">
              <input
                type="checkbox"
                checked={replySpoiler}
                onChange={(event) => setReplySpoiler(event.target.checked)}
              />
              Spoiler içeriyor
            </label>
            <button
              type="button"
              className="btn btn-primary self-start"
              onClick={submitReply}
              disabled={busy || reply.trim().length === 0}
            >
              {busy ? "Gönderiliyor…" : "Yanıtla"}
            </button>
            {error ? (
              <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
                {error}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="muted mt-3">
            Yanıt yazmak için{" "}
            <Link href="/login" className="text-gold-400 hover:underline">
              giriş yapın
            </Link>
            .
          </p>
        )}
      </div>
    </section>
  );
}
