"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type ListView = {
  id: string;
  userId: string;
  userName: string;
  name: string;
  description: string | null;
  visibility: "private" | "followers" | "public";
  createdAt: string;
  updatedAt: string;
  itemCount: number;
};

const VISIBILITY_LABELS: Record<ListView["visibility"], string> = {
  private: "Özel",
  followers: "Takipçilerim",
  public: "Herkese açık",
};

export function ListCard({
  list,
  viewerId,
  onDelete,
}: {
  list: ListView;
  viewerId: string | null;
  onDelete?: (listId: string) => void;
}) {
  const isOwner = viewerId === list.userId;
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm("Bu listeyi silmek istediğinize emin misiniz?")) return;
    setDeleting(true);
    try {
      await onDelete?.(list.id);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Link
      href={`/lists/${list.id}`}
      className="surface group flex flex-col h-full transition-colors hover:border-gold-500/30"
    >
      {list.itemCount > 0 ? (
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-t-xl bg-ink-800">
          <div className="absolute inset-0 flex items-center justify-center text-gold-400 text-3xl font-display font-bold">
            {list.name.slice(0, 1).toLocaleUpperCase("tr")}
          </div>
        </div>
      ) : (
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-t-xl bg-ink-800">
          <div className="absolute inset-0 flex items-center justify-center text-mist-500 text-xs">
            Henüz öğe yok
          </div>
        </div>
      )}

      <div className="flex-1 p-3 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display font-semibold text-mist-100 line-clamp-1 flex-1">
            {list.name}
          </h3>
          <span className="chip text-xs shrink-0">{VISIBILITY_LABELS[list.visibility]}</span>
        </div>

        {list.description ? (
          <p className="mt-1 text-sm text-mist-400 line-clamp-2 flex-1">
            {list.description}
          </p>
        ) : (
          <div className="mt-1 flex-1" />
        )}

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mist-500">
          <span className="font-medium text-mist-300">{list.userName}</span>
          <span aria-hidden="true">·</span>
          <span>{list.itemCount} öğe</span>
          <span>
            {new Date(list.createdAt).toLocaleDateString("tr-TR")}
          </span>
        </div>

        {isOwner ? (
          <button
            type="button"
            className="btn btn-ghost mt-2 w-full justify-start text-xs px-2 py-1 text-rose-400 hover:bg-rose-500/10"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "Siliniyor…" : "Listeyi sil"}
          </button>
        ) : null}
      </div>
    </Link>
  );
}

export function ListGrid({
  lists,
  viewerId,
  onDelete,
  emptyMessage = "Henüz liste yok.",
}: {
  lists: ListView[];
  viewerId: string | null;
  onDelete?: (listId: string) => void;
  emptyMessage?: string;
}) {
  if (lists.length === 0) {
    return (
      <div className="surface text-center py-12 px-4">
        <p className="muted">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {lists.map((list) => (
        <ListCard
          key={list.id}
          list={list}
          viewerId={viewerId}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

export function ListForm({
  initialName = "",
  initialDescription = "",
  initialVisibility = "private",
}: {
  initialName?: string;
  initialDescription?: string;
  initialVisibility?: ListView["visibility"];
}) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [visibility, setVisibility] = useState<
    ListView["visibility"]
  >(initialVisibility);

  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting || name.trim().length === 0) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          visibility,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(payload?.error ?? "Liste oluşturulamadı.");
        setSubmitting(false);
        return;
      }

      router.refresh();
    } catch {
      setError("Liste oluşturulamadı.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <label className="label" htmlFor="list-name">
          Liste adı
        </label>
        <input
          id="list-name"
          className="field"
          value={name}
          maxLength={100}
          placeholder="Örn: Favori bilim kurgu filmleri"
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="label" htmlFor="list-description">
          Açıklama (isteğe bağlı)
        </label>
        <textarea
          id="list-description"
          className="field min-h-[80px]"
          value={description}
          maxLength={2000}
          placeholder="Bu liste hakkında..."
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="list-visibility">
          Görünürlük
        </label>
        <select
          id="list-visibility"
          className="field"
          value={visibility}
          onChange={(e) =>
            setVisibility(e.target.value as ListView["visibility"])
          }
        >
          <option value="private">Özel (yalnızca ben)</option>
          <option value="followers">Takipçilerim (henüz aktif değil)</option>
          <option value="public">Herkese açık</option>
        </select>
        <p className="text-[0.7rem] text-mist-500 mt-0.5">
          &ldquo;Takipçilerim&rdquo; seçeneği takip sistemi eklenene kadar kullanılamaz.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        className="btn btn-primary self-start"
        disabled={submitting || name.trim().length === 0}
      >
        {submitting ? "Kaydediliyor…" : "Listeyi oluştur"}
      </button>
    </form>
  );
}