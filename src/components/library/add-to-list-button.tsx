"use client";

import { useState } from "react";

export function AddToListButton({
  titleId,
  userId,
}: {
  titleId: string;
  userId: string | null;
}) {
  const [lists, setLists] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newListName, setNewListName] = useState("");

  if (!userId) return null;
  const uid = userId;

  async function loadLists() {
    try {
      const response = await fetch(
        `/api/lists?userId=${encodeURIComponent(uid)}`,
      );
      if (response.ok) {
        const data = (await response.json()) as { items: { id: string; name: string }[] };
        setLists(data.items);
      }
    } catch {
      // ignore
    }
  }

  async function addToList(listId: string) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/lists/${listId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleId, note: null }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Listeye eklenemedi.");
        return;
      }
      setOpen(false);
      await loadLists();
    } catch {
      setError("Ağ hatası: listeye eklenemedi.");
    } finally {
      setLoading(false);
    }
  }

  async function createAndAdd() {
    if (!newListName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newListName.trim(),
          visibility: "private",
        }),
      });
      const data = (await response.json()) as { error?: string; listId?: string };
      if (!response.ok) {
        setError(data.error ?? "Liste oluşturulamadı.");
        return;
      }
      if (data.listId) {
        await addToList(data.listId);
        setNewListName("");
      }
    } catch {
      setError("Ağ hatası: liste oluşturulamadı.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="btn btn-outline flex items-center gap-2"
        onClick={() => {
          loadLists();
          setOpen(true);
        }}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 5v14M5 12h14"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
        Listeye ekle
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 surface w-72 p-3 shadow-lg border border-ink-700 animate-fade-up"
          role="menu"
        >
          <p className="label text-xs mb-2">Liste seçin veya oluşturun</p>

          {lists.length === 0 ? (
            <p className="muted text-sm mb-2">Henüz listeniz yok.</p>
          ) : (
            <ul className="max-h-60 overflow-auto mb-2" role="listbox">
              {lists.map((list) => (
                <li key={list.id} role="option" aria-selected="false">
                  <button
                    type="button"
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-ink-800 text-sm text-mist-300 flex items-center justify-between"
                    onClick={() => addToList(list.id)}
                    disabled={loading}
                  >
                    {list.name}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M12 5v14M5 12h14"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-ink-700 pt-2">
            <label className="label text-xs mb-1 block">Yeni liste adı</label>
            <div className="flex gap-1">
              <input
                type="text"
                className="field flex-1 text-sm"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="Yeni liste adı..."
                maxLength={100}
                onKeyDown={(e) => e.key === "Enter" && createAndAdd()}
              />
              <button
                type="button"
                className="btn btn-primary text-sm px-3"
                onClick={createAndAdd}
                disabled={loading || !newListName.trim()}
              >
                Oluştur ve ekle
              </button>
            </div>
          </div>

          {error ? (
            <p className="mt-2 text-xs text-rose-400">{error}</p>
          ) : null}

          <button
            type="button"
            className="btn btn-ghost w-full mt-2 text-sm"
            onClick={() => setOpen(false)}
          >
            Kapat
          </button>
        </div>
      )}

      {/* Click-away katmani yalnizca acilir menu acikken gecici olarak
          render edilir; sabit durursa tum sayfayi kaplar. */}
      {open ? (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}