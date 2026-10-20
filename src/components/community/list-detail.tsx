"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Button } from "@/components/ui/button";

export type ListItemView = {
  id: string;
  listId: string;
  titleId: string;
  titleName: string;
  titleReleaseYear: number | null;
  titlePosterUrl: string | null;
  position: number;
  note: string | null;
  createdAt: string;
};

export type ListDetailView = {
  id: string;
  userId: string;
  userName: string;
  name: string;
  description: string | null;
  visibility: "private" | "followers" | "public";
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  items: ListItemView[];
};

interface SortableItemProps {
  item: ListItemView;
  index: number;
  isOwner: boolean;
  onRemove: (titleId: string) => void;
  onNoteChange: (titleId: string, note: string) => void;
}

function SortableItem({
  item,
  index,
  isOwner,
  onRemove,
  onNoteChange,
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [editingNote, setEditingNote] = useState(false);
  const [noteValue, setNoteValue] = useState(item.note ?? "");

  async function handleRemove() {
    if (!window.confirm("Bu öğeyi listeden kaldırmak istediğinize emin misiniz?"))
      return;
    onRemove(item.titleId);
  }

  async function handleNoteSave() {
    onNoteChange(item.titleId, noteValue.trim());
    setEditingNote(false);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-start gap-3 p-3 rounded-lg bg-ink-900/50 border border-ink-700 transition-colors hover:border-ink-600"
    >
      <div
        {...attributes}
        {...listeners}
        className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-mist-500 cursor-grab active:cursor-grabbing text-sm font-medium"
        aria-label="Sıralamak için sürükleyin"
      >
        {isDragging ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M9 5v14M15 5v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        ) : (
          <span>{index + 1}</span>
        )}
      </div>

      <div className="relative w-20 h-30 flex-shrink-0">
        {item.titlePosterUrl ? (
          <Image
            src={item.titlePosterUrl}
            alt={`${item.titleName} posteri`}
            fill
            className="object-cover rounded"
            sizes="80px"
            unoptimized
          />
        ) : (
          <div className="w-full h-full rounded bg-ink-800 flex items-center justify-center text-xs text-mist-500">
            Poster yok
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <Link
          href={`/title/${item.titleId}`}
          className="font-medium text-mist-100 hover:text-gold-300 truncate block"
        >
          {item.titleName}
        </Link>
        {item.titleReleaseYear ? (
          <span className="text-xs text-mist-500">({item.titleReleaseYear})</span>
        ) : null}

        {isOwner ? (
          <div className="mt-2 flex flex-col gap-1">
            {editingNote ? (
              <div className="flex gap-1">
                <input
                  type="text"
                  className="field flex-1 text-xs"
                  value={noteValue}
                  onChange={(e) => setNoteValue(e.target.value)}
                  placeholder="Not ekleyin..."
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleNoteSave()}
                  onBlur={handleNoteSave}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNoteSave}
                  className="h-7 px-2"
                >
                  Kaydet
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {item.note ? (
                  <p className="text-sm text-mist-300 line-clamp-2 flex-1">
                    {item.note}
                  </p>
                ) : (
                  <button
                    type="button"
                    className="text-xs text-gold-400 hover:underline flex-1 text-left"
                    onClick={() => setEditingNote(true)}
                  >
                    Not ekle
                  </button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemove}
                  className="text-rose-400 hover:bg-rose-500/10 h-7 px-2"
                >
                  Kaldır
                </Button>
              </div>
            )}
          </div>
        ) : item.note ? (
          <p className="mt-1 text-sm text-mist-400 italic line-clamp-2">
            {item.note}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function ListDetail({
  list: initialList,
  viewerId,
}: {
  list: ListDetailView;
  viewerId: string | null;
}) {
  const router = useRouter();
  const [list, setList] = useState<ListDetailView>(initialList);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialList.name);
  const [description, setDescription] = useState(initialList.description ?? "");
  const [visibility, setVisibility] = useState<
    ListDetailView["visibility"]
  >(initialList.visibility);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = viewerId === list.userId;

  async function refresh() {
    const response = await fetch(`/api/lists/${list.id}`);
    if (response.ok) {
      const data = (await response.json()) as { list: ListDetailView };
      setList(data.list);
    }
  }

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/lists/${list.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, visibility }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Liste güncellenemedi.");
        return;
      }
      setEditing(false);
      await refresh();
    } catch {
      setError("Ağ hatası: liste güncellenemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Bu listeyi ve tüm öğelerini silmek istediğinize emin misiniz?"))
      return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/lists/${list.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "Liste silinemedi.");
        return;
      }
      router.push("/lists");
      router.refresh();
    } catch {
      setError("Ağ hatası: liste silinemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveItem(titleId: string) {
    setBusy(true);
    try {
      const response = await fetch(
        `/api/lists/${list.id}/items/${encodeURIComponent(titleId)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "Öğe kaldırılamadı.");
        return;
      }
      await refresh();
    } catch {
      setError("Ağ hatası: öğe kaldırılamadı.");
    } finally {
      setBusy(false);
    }
  }

  async function handleNoteChange(titleId: string, note: string | null) {
    try {
      const response = await fetch(`/api/lists/${list.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleId, note }),
      });
      if (!response.ok) {
        setError("Not kaydedilemedi.");
        return;
      }
      await refresh();
    } catch {
      setError("Ağ hatası: not kaydedilemedi.");
    }
  }

  const VISIBILITY_LABELS: Record<ListDetailView["visibility"], string> = {
    private: "Özel",
    followers: "Takipçilerim",
    public: "Herkese açık",
  };

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
                maxLength={100}
              />
              <textarea
                className="field min-h-[60px] text-sm"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                placeholder="Açıklama..."
              />
              <div className="flex items-center gap-3">
                <label className="label">Görünürlük</label>
                <select
                  className="field w-auto"
                  value={visibility}
                  onChange={(e) =>
                    setVisibility(e.target.value as ListDetailView["visibility"])
                  }
                >
                  <option value="private">Özel</option>
                  <option value="followers">Takipçilerim</option>
                  <option value="public">Herkese açık</option>
                </select>
                <p className="text-[0.7rem] text-mist-500">
                  &ldquo;Takipçilerim&rdquo; henüz aktif değil.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  onClick={handleSave}
                  disabled={busy || name.trim().length === 0}
                >
                  {busy ? "Kaydediliyor…" : "Kaydet"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setName(list.name);
                    setDescription(list.description ?? "");
                    setVisibility(list.visibility);
                    setEditing(false);
                  }}
                  disabled={busy}
                >
                  İptal
                </Button>
              </div>
            </div>
          ) : (
            <>
              <h2 className="font-display text-2xl font-semibold">
                {list.name}
              </h2>
              {list.description ? (
                <p className="mt-1 text-mist-400">{list.description}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mist-500">
                <span className="font-medium text-mist-300">{list.userName}</span>
                <span aria-hidden="true">·</span>
                <span className="chip text-xs">{VISIBILITY_LABELS[list.visibility]}</span>
                <span>{list.itemCount} öğe</span>
                <span>
                  {new Date(list.createdAt).toLocaleDateString("tr-TR")}
                </span>
              </div>
            </>
          )}
        </div>

        {isOwner ? (
          <div className="flex flex-col gap-2 shrink-0">
            {!editing ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                  Düzenle
                </Button>
                <Button variant="ghost" size="sm" className="text-rose-400" onClick={handleDelete}>
                  Sil
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                İptal
              </Button>
            )}
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
          {error}
        </div>
      ) : null}

      {list.items.length === 0 ? (
        <div className="mt-6 text-center py-8">
          <p className="muted">Bu listede henüz öğe yok.</p>
          <p className="text-xs text-mist-500 mt-1">
            Yapım sayfasından &ldquo;Listeye ekle&rdquo; diyerek öğe ekleyebilirsiniz.
          </p>
        </div>
      ) : (
        <div className="mt-4">
          <div
            className="space-y-2"
            role="list"
            aria-label={`&#34;${list.name}&#34; listesi &#246;&#287;eleri`}
          >
            {list.items.map((item, index) => (
              <SortableItem
                key={item.id}
                item={item}
                index={index}
                isOwner={isOwner}
                onRemove={handleRemoveItem}
                onNoteChange={handleNoteChange}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}