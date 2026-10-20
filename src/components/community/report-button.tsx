"use client";

import { useState } from "react";

export type ReportReason =
  | "spam"
  | "harassment"
  | "hate_speech"
  | "sexual_content"
  | "violence"
  | "spoiler"
  | "misinformation"
  | "copyright"
  | "other";

const REASON_LABELS: Record<ReportReason, string> = {
  spam: "Spam / İlgisiz",
  harassment: "Taciz / Rahatsız edici",
  hate_speech: "Nefret söylemi",
  sexual_content: "Cinsel içerik",
  violence: "Şiddet / Zarar verme",
  spoiler: "Spoiler (uyarısız)",
  misinformation: "Yanlış bilgi",
  copyright: "Telif hakkı ihlali",
  other: "Diğer",
};

export function ReportButton({
  targetType,
  targetId,
  onReported,
}: {
  targetType: "review" | "reply" | "thread" | "post" | "user";
  targetId: string;
  onReported?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("other");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!reason) {
      setError("Lütfen bir neden seçin.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType,
          targetId,
          reason,
          details: details.trim() || null,
        }),
      });
      const data = (await response.json()) as { error?: string; code?: string };
      if (!response.ok) {
        if (data.code === "self_report") {
          setError("Kendinizi raporlayamazsınız.");
        } else {
          setError(data.error ?? "Rapor gönderilemedi.");
        }
        return;
      }
      setOpen(false);
      setReason("other");
      setDetails("");
      onReported?.();
    } catch {
      setError("Ağ hatası: rapor gönderilemedi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost text-xs text-rose-400 hover:bg-rose-500/10"
        onClick={() => setOpen(true)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5v14M12 5a7 7 0 017 7h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        Rapor et
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
          <div className="surface w-full max-w-md p-5 rounded-xl animate-fade-up">
            <h3 className="font-display text-lg font-semibold">İçeriği rapor et</h3>
            <p className="muted mt-1 text-sm">
              Bu içeriğin neden rapor edilmesi gerektiğini seçin.
            </p>

            <div className="mt-4 space-y-2 max-h-60 overflow-auto">
              {Object.entries(REASON_LABELS).map(([value, label]) => (
                <label
                  key={value}
                  className={`flex items-center gap-3 p-2 rounded-lg border transition-colors cursor-pointer ${
                    reason === value
                      ? "border-gold-500/50 bg-gold-500/10"
                      : "border-ink-700 hover:border-ink-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={value}
                    checked={reason === value}
                    onChange={() => setReason(value as ReportReason)}
                    className="text-gold-500 focus:ring-gold-500"
                  />
                  <span className="text-sm text-mist-300">{label}</span>
                </label>
              ))}
            </div>

            <div className="mt-4">
              <label className="label" htmlFor="report-details">
                Ek açıklama (isteğe bağlı)
              </label>
              <textarea
                id="report-details"
                className="field min-h-[80px] text-sm"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={2000}
                placeholder="Ek bağlam veya detay..."
              />
            </div>

            {error ? (
              <p className="mt-3 text-xs text-rose-400">{error}</p>
            ) : null}

            <div className="mt-4 flex gap-2 justify-end">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                İptal
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={submit}
                disabled={busy}
              >
                {busy ? "Gönderiliyor…" : "Rapor gönder"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}