"use client";

import { useState } from "react";

type ImportSummary = {
  libraryImported: number;
  librarySkipped: { titleName: string; reason: string }[];
  reviewsImported: number;
  reviewsSkipped: { titleName: string; reason: string }[];
};

export function DataTransferPanel({
  displayName,
  exportedAtHint,
}: {
  displayName: string;
  exportedAtHint: string;
}) {
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function importContent(content: string, contentType: string) {
    setBusy(true);
    setError(null);
    setSummary(null);
    try {
      const response = await fetch("/api/data/import", {
        method: "POST",
        headers: { "Content-Type": contentType },
        body: content,
      });
      const data = (await response.json()) as ImportSummary & { error?: string };
      if (!response.ok) {
        setError(data.error ?? "İçe aktarma başarısız.");
        return;
      }
      setSummary(data);
    } catch {
      setError("Ağ hatası: içe aktarma başarısız.");
    } finally {
      setBusy(false);
    }
  }

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const contentType = file.name.toLowerCase().endsWith(".csv")
      ? "text/csv"
      : "application/json";
    await importContent(text, contentType);
    event.target.value = "";
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="surface p-4 sm:p-5">
        <h2 className="section-title">Verilerimi dışa aktar</h2>
        <p className="muted mt-1">
          Kütüphanenizdeki yapımlar, puanlarınız, notlarınız ve incelemeleriniz
          gerçek verilerinizdir. İstediğiniz zaman taşınabilir biçimde indirin.
        </p>
        <p className="mt-1 text-[0.72rem] text-mist-500">
          Aktarım anı (son yükleme): {exportedAtHint}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            className="btn btn-primary"
            href="/api/data/export?format=json"
            download
          >
            JSON olarak indir
          </a>
          <a
            className="btn btn-ghost"
            href="/api/data/export?format=csv"
            download
          >
            Kütüphaneyi CSV indir
          </a>
        </div>
        <p className="mt-2 text-[0.72rem] text-mist-500">
          JSON dosyası kütüphane + incelemeleri içerir; CSV yalnızca kütüphane
          listesini içerir.
        </p>
      </section>

      <section className="surface p-4 sm:p-5">
        <h2 className="section-title">Veri içe aktar</h2>
        <p className="muted mt-1">
          Daha önce indirdiğiniz bir JSON yedeğini veya CSV dosyasını yükleyin.
          Kayıtlar <strong className="text-mist-200">yalnızca katalogda var olan</strong>{" "}
          yapımlarla eşleştirilir; eşleşmeyenler atlanır ve aşağıda listelenir.
          Böylece doğrulanmamış veri oluşturulmaz.
        </p>

        <div className="mt-3">
          <label className="label" htmlFor="import-file">
            Dosya seç
          </label>
          <input
            id="import-file"
            type="file"
            accept=".json,application/json,.csv,text/csv"
            className="field"
            onChange={onFile}
            disabled={busy}
          />
        </div>

        <div className="mt-4">
          <label className="label" htmlFor="import-paste">
            veya JSON/CSV içeriğini yapıştır
          </label>
          <textarea
            id="import-paste"
            className="field min-h-[120px] font-mono text-xs"
            value={pasted}
            onChange={(event) => setPasted(event.target.value)}
            placeholder='{"library":[{"titleName":"Inception","status":"watched",...}],"reviews":[]}'
          />
          <button
            type="button"
            className="btn btn-ghost mt-2"
            disabled={busy || pasted.trim().length === 0}
            onClick={() => {
              const trimmed = pasted.trim();
              const contentType = trimmed.startsWith("{") || trimmed.startsWith("[")
                ? "application/json"
                : "text/csv";
              void importContent(trimmed, contentType);
            }}
          >
            {busy ? "İçe aktarılıyor…" : "Yapıştırılanı içe aktar"}
          </button>
        </div>

        {error ? (
          <p className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
            {error}
          </p>
        ) : null}

        {summary ? (
          <div className="mt-3 flex flex-col gap-2">
            <p className="rounded-lg border border-jade-500/40 bg-jade-500/10 px-3 py-2 text-xs text-jade-400">
              {displayName}, {summary.libraryImported} kütüphane kaydı ve{" "}
              {summary.reviewsImported} inceleme içe aktarıldı.
            </p>
            {summary.librarySkipped.length > 0 ? (
              <div className="surface-flat p-3">
                <p className="label">
                  Atlanan kütüphane kayıtları ({summary.librarySkipped.length})
                </p>
                <ul className="flex flex-col gap-1 text-xs text-mist-400">
                  {summary.librarySkipped.slice(0, 20).map((item, index) => (
                    <li key={index}>
                      <span className="text-mist-200">{item.titleName}</span> —{" "}
                      {item.reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {summary.reviewsSkipped.length > 0 ? (
              <div className="surface-flat p-3">
                <p className="label">
                  Atlanan incelemeler ({summary.reviewsSkipped.length})
                </p>
                <ul className="flex flex-col gap-1 text-xs text-mist-400">
                  {summary.reviewsSkipped.slice(0, 20).map((item, index) => (
                    <li key={index}>
                      <span className="text-mist-200">{item.titleName}</span> —{" "}
                      {item.reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
