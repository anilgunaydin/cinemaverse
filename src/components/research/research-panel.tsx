"use client";

import { useState } from "react";

type ResearchItem = {
  id: string;
  sourceName: string;
  sourceUrl: string;
  heading: string | null;
  excerpt: string;
  author: string | null;
  publishedAt: string | null;
  licenseNote: string;
  spoilerRisk: "low" | "medium" | "high" | "unknown";
};

type ResearchSession = {
  sessionId: string;
  question: string | null;
  status: string;
  summary: string | null;
  summaryGeneratedByAi: boolean;
  sourceCount: number;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
  items: ResearchItem[];
};

type SessionMeta = Omit<ResearchSession, "items">;

const RISK_LABEL: Record<ResearchItem["spoilerRisk"], string> = {
  low: "Spoiler riski düşük (tahmin)",
  medium: "Spoiler riski orta (tahmin)",
  high: "Spoiler riski yüksek (tahmin)",
  unknown: "Spoiler riski değerlendirilemedi",
};

const RISK_CLASS: Record<ResearchItem["spoilerRisk"], string> = {
  low: "chip chip-jade",
  medium: "chip chip-gold",
  high: "chip chip-rose",
  unknown: "chip",
};

export function ResearchPanel({
  titleId,
  isLoggedIn,
  aiEnabled,
  initialSessions,
}: {
  titleId: string;
  isLoggedIn: boolean;
  aiEnabled: boolean;
  initialSessions: SessionMeta[];
}) {
  const [sessions, setSessions] = useState<SessionMeta[]>(initialSessions);
  const [active, setActive] = useState<ResearchSession | null>(null);
  const [question, setQuestion] = useState("");
  const [withAi, setWithAi] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  async function refreshSessions() {
    try {
      const response = await fetch(
        `/api/research?titleId=${encodeURIComponent(titleId)}`,
      );
      if (!response.ok) return;
      const data = (await response.json()) as { sessions: SessionMeta[] };
      setSessions(data.sessions);
    } catch {
      // Sessizce gec; kullanici tekrar deneyebilir.
    }
  }

  async function loadSession(sessionId: string) {
    const response = await fetch(
      `/api/research?sessionId=${encodeURIComponent(sessionId)}`,
    );
    if (!response.ok) return;
    const data = (await response.json()) as { session: ResearchSession };
    setActive(data.session);
    setOpenItems(new Set());
  }

  async function runResearch() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titleId,
          question: question.trim() || undefined,
          withAiSummary: withAi && aiEnabled,
        }),
      });
      const data = (await response.json()) as { sessionId?: string; error?: string };
      if (!response.ok) {
        setError(data.error ?? "Araştırma başlatılamadı.");
        return;
      }
      if (data.sessionId) await loadSession(data.sessionId);
      await refreshSessions();
    } catch {
      setError("Ağ hatası: araştırma başlatılamadı.");
    } finally {
      setLoading(false);
    }
  }

  function toggleItem(id: string) {
    setOpenItems((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!isLoggedIn) {
    return (
      <section className="surface p-4 sm:p-5">
        <h2 className="section-title">İnternet inceleme araştırması</h2>
        <p className="muted mt-1">
          Kaynak temelli inceleme araştırması için giriş yapmanız gerekir.
        </p>
      </section>
    );
  }

  return (
    <section className="surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="section-title">İnternet inceleme araştırması</h2>
        <span className="chip">Kaynak: Wikipedia (CC BY-SA), opsiyonel TMDB</span>
      </div>
      <p className="muted mt-1">
        Yalnızca gerçek kaynaklardan alıntılar toplanır. Kaynak bulunamazsa bu
        açıkça belirtilir; hiçbir yorum uydurulmaz.
      </p>

      <div className="mt-3 flex flex-col gap-2">
        <input
          className="field"
          placeholder="İsteğe bağlı soru (örn. Eleştirmenler filmi nasıl değerlendirdi?)"
          value={question}
          maxLength={500}
          onChange={(event) => setQuestion(event.target.value)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-mist-400">
            <input
              type="checkbox"
              checked={withAi}
              disabled={!aiEnabled}
              onChange={(event) => setWithAi(event.target.checked)}
            />
            AI özeti ekle {aiEnabled ? "" : "(AI kapalı)"}
          </label>
          <button
            type="button"
            className="btn btn-primary"
            onClick={runResearch}
            disabled={loading}
          >
            {loading ? "Araştırılıyor…" : "Kaynakları araştır"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
          {error}
        </p>
      ) : null}

      {aiEnabled && withAi ? (
        <p className="mt-2 text-[0.7rem] text-mist-500">
          AI özeti, toplanan kaynak alıntılarına dayanır ve yapay zekâ üretimi
          olarak işaretlenir.
        </p>
      ) : null}

      {sessions.length > 0 ? (
        <div className="mt-4">
          <p className="label">Önceki araştırmalar</p>
          <div className="flex flex-wrap gap-1.5">
            {sessions.map((session) => (
              <button
                key={session.sessionId}
                type="button"
                className={`chip ${
                  active?.sessionId === session.sessionId ? "chip-gold" : ""
                }`}
                onClick={() => void loadSession(session.sessionId)}
              >
                {new Date(session.createdAt).toLocaleString("tr-TR")} ·{" "}
                {session.sourceCount} kaynak
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {active ? (
        <div className="mt-4 flex flex-col gap-3">
          {active.status === "partial" || active.sourceCount === 0 ? (
            <p className="rounded-lg border border-gold-500/30 bg-gold-500/10 px-3 py-2 text-xs text-gold-300">
              {active.error ?? "Kaynaklarda değerlendirme bulunamadı."}
            </p>
          ) : null}

          {active.summary ? (
            <div className="surface-flat p-3">
              <div className="flex items-center gap-2">
                <span className="chip chip-gold">AI özeti</span>
                <span className="text-[0.7rem] text-mist-500">
                  Yapay zekâ tarafından üretildi; kaynaklara dayanır, hata
                  içerebilir.
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-mist-200">
                {active.summary}
              </p>
            </div>
          ) : null}

          <ul className="flex flex-col gap-3">
            {active.items.map((item) => {
              const open = openItems.has(item.id);
              const risky =
                item.spoilerRisk === "high" || item.spoilerRisk === "medium";
              return (
                <li key={item.id} className="surface-flat p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="chip chip-gold">{item.sourceName}</span>
                    {item.heading ? (
                      <span className="text-sm font-medium text-mist-200">
                        {item.heading}
                      </span>
                    ) : null}
                    <span className={RISK_CLASS[item.spoilerRisk]}>
                      {RISK_LABEL[item.spoilerRisk]}
                    </span>
                  </div>

                  {open ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-mist-300">
                      {item.excerpt}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm italic text-mist-500">
                      {risky
                        ? "Spoiler içerebilir. Göstermek için tıklayın."
                        : "Alıntıyı göstermek için tıklayın."}
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[0.7rem] text-mist-500">
                    <button
                      type="button"
                      className="text-gold-400 hover:underline"
                      onClick={() => toggleItem(item.id)}
                    >
                      {open ? "Gizle" : "Alıntıyı göster"}
                    </button>
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-gold-400 hover:underline"
                    >
                      Kaynağa git
                    </a>
                    {item.author ? <span>{item.author}</span> : null}
                    {item.publishedAt ? <span>{item.publishedAt}</span> : null}
                    <span>{item.licenseNote}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
