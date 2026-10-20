"use client";

import { useEffect, useRef, useState } from "react";

export type AiStatusView = {
  enabled: boolean;
  provider: string;
  model: string | null;
  reason: string;
};

type Conversation = {
  id: string;
  heading: string;
  spoilerMode: "none" | "progress" | "season" | "all";
  spoilerSeason: number | null;
  provider: string | null;
  model: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiMessageView = {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  provider: string | null;
  model: string | null;
  createdAt: string;
};

const SPOILER_OPTIONS: { value: Conversation["spoilerMode"]; label: string }[] = [
  { value: "none", label: "Spoiler istemiyorum" },
  { value: "progress", label: "İzlediğim yere kadar" },
  { value: "season", label: "Belirli sezona kadar" },
  { value: "all", label: "Her şeyi tartışabiliriz" },
];

export function AiDiscussion({
  titleId,
  isLoggedIn,
  defaultSeason,
  status,
  initialConversations,
  initialMessages,
}: {
  titleId: string;
  isLoggedIn: boolean;
  defaultSeason: number | null;
  status: AiStatusView | null;
  initialConversations: Conversation[];
  initialMessages: AiMessageView[];
}) {
  const [conversations, setConversations] =
    useState<Conversation[]>(initialConversations);
  const [active, setActive] = useState<Conversation | null>(
    initialConversations[0] ?? null,
  );
  const [messages, setMessages] = useState<AiMessageView[]>(initialMessages);
  const [spoilerMode, setSpoilerMode] = useState<Conversation["spoilerMode"]>(
    defaultSeason ? "progress" : "none",
  );
  const [spoilerSeason, setSpoilerSeason] = useState<number>(defaultSeason ?? 1);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  async function openConversation(id: string) {
    const response = await fetch(`/api/ai/conversations/${id}`);
    if (!response.ok) return;
    const data = (await response.json()) as {
      conversation: Conversation;
      messages: AiMessageView[];
    };
    setActive(data.conversation);
    setMessages(data.messages);
  }

  async function startConversation() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titleId,
          heading: "Yapım tartışması",
          spoilerMode,
          spoilerSeason: spoilerMode === "season" ? spoilerSeason : null,
        }),
      });
      const data = (await response.json()) as {
        conversation?: Conversation;
        error?: string;
      };
      if (!response.ok || !data.conversation) {
        setError(data.error ?? "Tartışma açılamadı.");
        return;
      }
      setActive(data.conversation);
      setMessages([]);
      setConversations((previous) => [data.conversation as Conversation, ...previous]);
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!active) return;
    const content = input.trim();
    if (!content || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/ai/conversations/${active.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = (await response.json()) as {
        userMessage?: AiMessageView;
        assistantMessage?: AiMessageView;
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "Mesaj gönderilemedi.");
        return;
      }
      if (data.userMessage && data.assistantMessage) {
        setMessages((previous) => [
          ...previous,
          data.userMessage as AiMessageView,
          data.assistantMessage as AiMessageView,
        ]);
        setInput("");
      }
    } catch {
      setError("Ağ hatası: mesaj gönderilemedi.");
    } finally {
      setBusy(false);
    }
  }

  if (!isLoggedIn) {
    return (
      <section className="surface p-4 sm:p-5">
        <h2 className="section-title">AI ile tartış</h2>
        <p className="muted mt-1">
          Yapay zekâ destekli tartışma için giriş yapmanız gerekir.
        </p>
      </section>
    );
  }

  const disabled = status && !status.enabled;

  return (
    <section className="surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="section-title">AI ile tartış</h2>
        {status?.enabled ? (
          <span className="chip chip-jade">
            {status.provider}
            {status.model ? ` · ${status.model}` : ""}
          </span>
        ) : (
          <span className="chip">Kapalı</span>
        )}
      </div>

      {status === null ? (
        <p className="muted mt-1">AI durumu yüklenemedi.</p>
      ) : disabled ? (
        <div className="mt-2 rounded-lg border border-ink-600 bg-ink-900 px-3 py-2.5">
          <p className="text-sm text-mist-300">{status.reason}</p>
          <p className="mt-1 text-[0.72rem] text-mist-500">
            Kapalıyken hiçbir yapay zekâ servisine veri gönderilmez ve sohbet
            kaydedilmez.
          </p>
        </div>
      ) : (
        <>
          {!active ? (
            <div className="mt-3 flex flex-col gap-2">
              <p className="muted">
                Yeni bir tartışma başlatın. Spoiler korumasını siz belirlersiniz.
              </p>
              <select
                className="field"
                value={spoilerMode}
                onChange={(event) =>
                  setSpoilerMode(event.target.value as Conversation["spoilerMode"])
                }
              >
                {SPOILER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {spoilerMode === "season" ? (
                <input
                  type="number"
                  min={1}
                  max={100}
                  className="field"
                  value={spoilerSeason}
                  onChange={(event) => setSpoilerSeason(Number(event.target.value))}
                  placeholder="Sezon numarası"
                />
              ) : null}
              {spoilerMode === "progress" && defaultSeason === null ? (
                <p className="text-[0.72rem] text-mist-500">
                  İzleme ilerlemeniz kayıtlı değil; bu nedenle AI spoiler
                  vermemeye çalışacak.
                </p>
              ) : null}
              <button
                type="button"
                className="btn btn-primary self-start"
                onClick={startConversation}
                disabled={busy}
              >
                Tartışma başlat
              </button>
            </div>
          ) : (
            <div className="mt-3 flex flex-col gap-3">
              <div className="flex flex-wrap gap-1.5">
                {conversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    className={`chip ${
                      conversation.id === active.id ? "chip-gold" : ""
                    }`}
                    onClick={() => void openConversation(conversation.id)}
                  >
                    {SPOILER_OPTIONS.find((o) => o.value === conversation.spoilerMode)
                      ?.label ?? conversation.spoilerMode}
                    {conversation.spoilerSeason
                      ? ` (${conversation.spoilerSeason}. sezon)`
                      : ""}
                  </button>
                ))}
                <button
                  type="button"
                  className="chip"
                  onClick={() => {
                    setActive(null);
                    setMessages([]);
                  }}
                >
                  + Yeni
                </button>
              </div>

              <div
                ref={listRef}
                className="flex max-h-80 flex-col gap-2 overflow-y-auto rounded-lg border border-ink-700 bg-ink-950/60 p-3"
              >
                {messages.length === 0 ? (
                  <p className="text-sm italic text-mist-500">
                    Henüz mesaj yok. Bir soru yazarak başlayın.
                  </p>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                        message.role === "user"
                          ? "self-end bg-gold-500/15 text-mist-100"
                          : "self-start bg-ink-800 text-mist-200"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      {message.role === "assistant" ? (
                        <p className="mt-1 text-[0.65rem] text-mist-500">
                          AI üretimi
                          {message.provider ? ` · ${message.provider}` : ""}
                        </p>
                      ) : null}
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-2">
                <textarea
                  className="field min-h-[44px] resize-y"
                  rows={2}
                  value={input}
                  maxLength={4000}
                  placeholder="Sorunuzu yazın…"
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn-primary self-end"
                  onClick={send}
                  disabled={busy || input.trim().length === 0}
                >
                  {busy ? "…" : "Gönder"}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {error ? (
        <p className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
          {error}
        </p>
      ) : null}
    </section>
  );
}
