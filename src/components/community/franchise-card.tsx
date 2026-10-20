"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type FranchiseView = {
  id: string;
  name: string;
  wikidataId: string | null;
  createdAt: string;
  titleCount: number;
};

/**
 * Not: Bu bileşenler Server Component'lerden çağrılır. Next.js, Server'dan
 * Client'a fonksiyon geçirilmesine izin vermez; bu yüzden ağ çağrıları
 * (oluştur / sil) tamamen bu bileşenlerin içinde yapılır. Server Component
 * yalnızca veri ve boolean gibi serileştirilebilir prop'lar geçer.
 */
export function FranchiseCard({
  franchise,
  isModerator = false,
}: {
  franchise: FranchiseView;
  isModerator?: boolean;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleCardClick = (e: React.MouseEvent) => {
    // Inside buttons/links have their own behavior; otherwise navigate to detail
    if ((e.target as HTMLElement).closest("button, a")) {
      return;
    }
    router.push(`/franchises/${franchise.id}`);
  };

  const handleWikidataClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (franchise.wikidataId) {
      window.open(
        `https://www.wikidata.org/wiki/${franchise.wikidataId}`,
        "_blank",
        "noopener,noreferrer"
      );
    }
  };

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (deleting) return;
    if (!window.confirm("Bu franchise'i silmek istediğinize emin misiniz?")) {
      return;
    }
    setDeleting(true);
    try {
      const response = await fetch(`/api/franchises/${franchise.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        window.alert("Franchise silinemedi.");
        setDeleting(false);
        return;
      }
      router.refresh();
    } catch {
      window.alert("Franchise silinemedi.");
      setDeleting(false);
    }
  }

  return (
    <div
      onClick={handleCardClick}
      className="surface group flex flex-col h-full transition-colors hover:border-gold-500/30 cursor-pointer"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-t-xl">
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950/80 to-transparent" />
        <div className="absolute inset-0 flex items-center justify-center text-gold-400 text-4xl font-display font-bold">
          {franchise.name.slice(0, 1).toLocaleUpperCase("tr")}
        </div>
      </div>

      <div className="flex-1 p-3 flex flex-col">
        <h3 className="font-display font-semibold text-mist-100 line-clamp-1 flex-1">
          {franchise.name}
        </h3>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mist-500">
          <span>{franchise.titleCount} yapım</span>
          {franchise.wikidataId ? (
            <button
              type="button"
              onClick={handleWikidataClick}
              className="text-gold-400 hover:underline text-xs"
            >
              Wikidata
            </button>
          ) : null}
        </div>

        {isModerator ? (
          <button
            type="button"
            className="btn btn-ghost mt-2 w-full justify-start text-xs px-2 py-1 text-rose-400 hover:bg-rose-500/10"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "Siliniyor…" : "Franchise'i sil"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function FranchiseGrid({
  franchises,
  isModerator = false,
  emptyMessage = "Henüz franchise yok.",
}: {
  franchises: FranchiseView[];
  isModerator?: boolean;
  emptyMessage?: string;
}) {
  if (franchises.length === 0) {
    return (
      <div className="surface text-center py-12 px-4">
        <p className="muted">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {franchises.map((franchise) => (
        <FranchiseCard
          key={franchise.id}
          franchise={franchise}
          isModerator={isModerator}
        />
      ))}
    </div>
  );
}

export function FranchiseForm({
  initialName = "",
  initialWikidataId = "",
}: {
  initialName?: string;
  initialWikidataId?: string;
}) {
  const [name, setName] = useState(initialName);
  const [wikidataId, setWikidataId] = useState(initialWikidataId);
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting || name.trim().length === 0) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/franchises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          wikidataId: wikidataId.trim() || null,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(payload?.error ?? "Franchise oluşturulamadı.");
        setSubmitting(false);
        return;
      }

      setName("");
      setWikidataId("");
      setSubmitting(false);
      router.refresh();
    } catch {
      setError("Franchise oluşturulamadı.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <label className="label" htmlFor="franchise-name">
          Franchise adı
        </label>
        <input
          id="franchise-name"
          className="field"
          value={name}
          maxLength={200}
          placeholder="Örn: Marvel Sinematik Evreni"
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="label" htmlFor="franchise-wikidata">
          Wikidata ID (isteğe bağlı)
        </label>
        <input
          id="franchise-wikidata"
          className="field"
          value={wikidataId}
          placeholder="Q123456"
          onChange={(e) => setWikidataId(e.target.value)}
        />
        <p className="text-[0.7rem] text-mist-500 mt-0.5">
          Wikidata entity ID&apos;si (örn: Q931513). Boş bırakılabilir.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        className="btn btn-primary self-start"
        disabled={submitting || name.trim().length === 0}
      >
        {submitting ? "Oluşturuluyor…" : "Franchise oluştur"}
      </button>
    </form>
  );
}
