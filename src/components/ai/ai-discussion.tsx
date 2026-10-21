"use client";

import { useEffect, useRef, useState } from "react";

import { DetailCard } from "@/components/catalog/detail-card";

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
  className = "",
}: {
  titleId: string;
  isLoggedIn: boolean;
  defaultSeason: number | null;
  status: AiStatusView | null;
  initialConversations: Conversation[];
  initialMessages: AiMessageView[];
  className?: string;
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

  const disabled = Boolean(status && !status.enabled);

  return (
    <DetailCard
      icon="ai"
      title="AI ile tartış"
      className={className}
      meta={
        status?.enabled ? (
          <span className="chip chip-jade">
            {status.provider}
            {status.model ? ` · ${status.model}` : ""}
          </span>
        ) : (
          <span className="chip">Kapalı</span>
        )
      }
    >
      {!isLoggedIn ? (
        <p className="text-sm text-mist-400">
          Yapay zekâ destekli tartışma için giriş yapın.
        </p>
      ) : status === null ? (
        <p className="text-sm text-mist-400">AI durumu yüklenemedi.</p>
      ) : disabled ? (
        <div className="rounded-lg border border-ink-600 bg-ink-900 px-3 py-2.5">
          <p className="text-sm text-mist-300">{status.reason}</p>
          <p className="mt-1 text-[0.7rem] text-mist-500">
            Kapalıyken hiçbir yapay zekâ servisine veri gönderilmez ve sohbet
            kaydedilmez.
          </p>
        </div>
      ) : !active ? (
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-2">
          <p className="text-sm text-mist-400">
            Yeni bir tartışma başlatın. Spoiler korumasını siz belirlersiniz.
          </p>
          <select
            className="field text-sm"
            value={spoilerMode}
            aria-label="Spoiler koruması"
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
              className="field text-sm"
              value={spoilerSeason}
              onChange={(event) => setSpoilerSeason(Number(event.target.value))}
              placeholder="Sezon numarası"
            />
          ) : null}
          {spoilerMode === "progress" && defaultSeason === null ? (
            <p className="text-[0.7rem] text-mist-500">
              İzleme ilerlemeniz kayıtlı değil; AI spoiler vermemeye çalışacak.
            </p>
          ) : null}
          <button
            type="button"
            className="btn btn-primary self-start text-xs"
            onClick={startConversation}
            disabled={busy}
          >
            Tartışma başlat
          </button>
        </div>
      ) : (
        <>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
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
              className="chip hover:border-gold-500/40 hover:text-gold-300"
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
            className="mt-2 flex min-h-[180px] flex-1 flex-col gap-2 overflow-y-auto rounded-lg border border-ink-700 bg-ink-950/60 p-2.5"
          >
            {messages.length === 0 ? (
              <p className="text-sm italic text-mist-500">
                Henüz mesaj yok. Bir soru yazarak başlayın.
              </p>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[88%] rounded-lg px-2.5 py-1.5 text-[0.82rem] leading-relaxed ${
                    message.role === "user"
                      ? "self-end bg-gold-500/15 text-mist-100"
                      : "self-start bg-ink-800 text-mist-200"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {message.role === "assistant" ? (
                    <p className="mt-1 text-[0.62rem] text-mist-500">
                      AI üretimi
                      {message.provider ? ` · ${message.provider}` : ""}
                    </p>
                  ) : null}
                </div>
              ))
            )}
          </div>

          <div className="mt-2 flex shrink-0 items-end gap-1.5">
            <textarea
              className="field min-h-[40px] resize-none text-sm"
              rows={2}
              value={input}
              maxLength={4000}
              placeholder="Sorunuzu yazın… (Enter ile gönder)"
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
              className="btn btn-primary"
              onClick={send}
              disabled={busy || input.trim().length === 0}
            >
              {busy ? "…" : "Gönder"}
            </button>
          </div>
        </>
      )}

      {error ? (
        <p className="mt-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
          {error}
        </p>
      ) : null}
    </DetailCard>
  );
}
