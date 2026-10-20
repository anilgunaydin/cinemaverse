"use client";

import { useState, useCallback } from "react";

export type ReportView = {
  id: string;
  reporterId: string;
  reporterName: string;
  targetType: "review" | "reply" | "thread" | "post" | "user";
  targetId: string;
  targetPreview: string;
  reason: string;
  details: string | null;
  status: "open" | "resolved" | "dismissed";
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
};

const REASON_LABELS: Record<string, string> = {
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

const STATUS_LABELS: Record<string, string> = {
  open: "Açık",
  resolved: "Çözüldü",
  dismissed: "Reddedildi",
};

const STATUS_COLORS: Record<string, string> = {
  open: "chip-gold",
  resolved: "chip-jade",
  dismissed: "chip-rose",
};

export function ReportList({
  initialReports = [],
  isModerator,
}: {
  initialReports: ReportView[];
  isModerator: boolean;
}) {
  const [reports, setReports] = useState<ReportView[]>(initialReports);
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "resolved" | "dismissed">("all");

  const loadReports = useCallback(async (filter: typeof statusFilter) => {
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("status", filter);
      const response = await fetch(`/api/reports?${params.toString()}`);
      if (response.ok) {
        const data = (await response.json()) as { items: ReportView[] };
        setReports(data.items);
      }
    } catch {
      // ignore
    }
  }, []);

  function handleFilterChange(filter: typeof statusFilter) {
    setStatusFilter(filter);
    loadReports(filter);
  }

  async function resolveReport(reportId: string, status: "resolved" | "dismissed") {
    if (!window.confirm(status === "resolved" ? "Bu raporu çözüldü olarak işaretlemek istediğinize emin misiniz?" : "Bu raporu reddetmek istediğinize emin misiniz?")) {
      return;
    }
    try {
      const response = await fetch(`/api/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        alert(data.error ?? "İşlem yapılamadı.");
        return;
      }
      loadReports(statusFilter);
    } catch {
      alert("Ağ hatası: işlem yapılamadı.");
    }
  }

  async function moderateContent(
    targetType: ReportView["targetType"],
    targetId: string,
    action: "hide" | "remove" | "restore",
  ) {
    const actionLabels = { hide: "gizlemek", remove: "kaldırmak", restore: "geri yüklemek" };
    if (!window.confirm(`Bu içeriği ${actionLabels[action]} istediğinize emin misiniz?`)) {
      return;
    }
    try {
      const response = await fetch("/api/moderation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, action }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        alert(data.error ?? "İşlem yapılamadı.");
        return;
      }
      loadReports(statusFilter);
    } catch {
      alert("Ağ hatası: işlem yapılamadı.");
    }
  }

  if (!isModerator && reports.length === 0) {
    return (
      <div className="surface text-center py-8">
        <p className="muted">Henüz raporunuz yok.</p>
      </div>
    );
  }

  return (
    <section className="surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="section-title">Raporlar</h2>
        <div className="flex items-center gap-2">
          <label className="label text-xs">Durum</label>
          <select
            className="field text-sm w-auto"
            value={statusFilter}
            onChange={(e) => handleFilterChange(e.target.value as typeof statusFilter)}
          >
            <option value="all">Tümü</option>
            <option value="open">Açık</option>
            <option value="resolved">Çözüldü</option>
            <option value="dismissed">Reddedildi</option>
          </select>
        </div>
      </div>

      {reports.length === 0 ? (
        <p className="muted mt-4 text-center">
          {statusFilter === "all" ? "Henüz rapor yok." : "Bu durumda rapor yok."}
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {reports.map((report) => (
            <div
              key={report.id}
              className="rounded-lg border border-ink-700 bg-ink-900/50 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-mist-500">
                    <span className="font-medium text-mist-300">{report.reporterName}</span>
                    <span aria-hidden="true">·</span>
                    <span className={`chip text-xs ${STATUS_COLORS[report.status]}`}>
                      {STATUS_LABELS[report.status]}
                    </span>
                    <span className={`chip text-xs`}>
                      {report.targetType === "user"
                        ? "Kullanıcı"
                        : report.targetType === "review"
                        ? "İnceleme"
                        : report.targetType === "reply"
                        ? "Yanıt"
                        : report.targetType === "thread"
                        ? "Konu"
                        : "Yanıt"}
                    </span>
                    <span>
                      {new Date(report.createdAt).toLocaleDateString("tr-TR")}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-mist-400">
                    <strong>Neden:</strong> {REASON_LABELS[report.reason] ?? report.reason}
                  </p>
                  {report.details ? (
                    <p className="mt-1 text-sm text-mist-500 italic">
                      {report.details}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-mist-500 font-mono truncate">
                    İçerik: {report.targetPreview}
                  </p>
                </div>

                {isModerator && report.status === "open" ? (
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      type="button"
                      className="btn btn-primary text-xs"
                      onClick={() => resolveReport(report.id, "resolved")}
                    >
                      Çözüldü
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost text-xs text-rose-400 hover:bg-rose-500/10"
                      onClick={() => resolveReport(report.id, "dismissed")}
                    >
                      Reddet
                    </button>
                  </div>
                ) : null}
              </div>

              {isModerator ? (
                <div className="mt-3 pt-3 border-t border-ink-700 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-ghost text-xs"
                    onClick={() => moderateContent(report.targetType, report.targetId, "hide")}
                  >
                    Gizle
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost text-xs text-rose-400 hover:bg-rose-500/10"
                    onClick={() => moderateContent(report.targetType, report.targetId, "remove")}
                  >
                    Kaldır
                  </button>
                  {report.status !== "open" ? (
                    <button
                      type="button"
                      className="btn btn-ghost text-xs text-jade-400 hover:bg-jade-500/10"
                      onClick={() => moderateContent(report.targetType, report.targetId, "restore")}
                    >
                      Geri yükle
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}