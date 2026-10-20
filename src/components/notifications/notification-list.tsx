"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Notification = {
  id: string;
  type: string;
  message: string;
  deepLink: string | null;
  isRead: boolean;
  createdAt: string;
};

const TYPE_ICONS: Record<string, string> = {
  follow: "👤",
  review: "✍️",
  review_reply: "💬",
  report: "🚨",
  mention: "📌",
  system: "⚙️",
};

const TYPE_LABELS: Record<string, string> = {
  follow: "Takip",
  review: "İnceleme",
  review_reply: "Yanıt",
  report: "Rapor",
  mention: "Bahsetme",
  system: "Sistem",
};

function formatTime(dateString: string) {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (mins < 1) return "Az önce";
  if (mins < 60) return `${mins} dakika önce`;
  if (hours < 24) return `${hours} saat önce`;
  if (days < 7) return `${days} gün önce`;
  return new Date(dateString).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function NotificationList() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async (unreadOnly = false) => {
    try {
      const res = await fetch(
        `/api/notifications?limit=50${unreadOnly ? "&unread=true" : ""}`
      );
      if (!res.ok) throw new Error("Bildirimler yüklenemedi");
      const data = await res.json();
      setNotifications(data.notifications);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchNotifications(filter === "unread");
  }, [filter, fetchNotifications]);

  const markRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    try {
      await fetch("/api/notifications/read", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
    } catch (e) {
      console.error("Failed to mark read:", e);
    }
  };

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await fetch("/api/notifications/read", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
    } catch (e) {
      console.error("Failed to mark all read:", e);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[0.68rem] uppercase tracking-[0.22em] text-gold-400">
            Topluluk
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">
            Bildirimler
          </h1>
          {unreadCount > 0 ? (
            <p className="muted mt-1 text-sm">{unreadCount} okunmamış bildirim</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1 rounded-lg border border-ink-600 bg-ink-900 p-1"
            role="group"
            aria-label="Bildirim filtresi"
          >
            {(
              [
                ["all", "Tümü"],
                ["unread", "Okunmamış"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                aria-pressed={filter === value}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  filter === value
                    ? "bg-gold-500/20 text-gold-300"
                    : "text-mist-400 hover:text-mist-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {unreadCount > 0 ? (
            <button onClick={markAllRead} className="btn btn-ghost text-xs">
              Tümünü okundu yap
            </button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="mt-6 space-y-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="surface-flat flex gap-3 p-4">
              <div className="skeleton h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-2/3" />
                <div className="skeleton h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="surface mt-6 p-6 text-center text-rose-400">{error}</div>
      ) : notifications.length === 0 ? (
        <div className="surface-flat mt-6 px-4 py-12 text-center">
          <span className="text-4xl">🔔</span>
          <p className="mt-3 font-medium text-mist-200">
            {filter === "unread" ? "Okunmamış bildirim yok" : "Henüz bildirim yok"}
          </p>
          <p className="muted mt-1 text-sm">
            Takipçileriniz yorum yazdığında, inceleme paylaştığında veya bir
            rapor açıldığında burada görünür.
          </p>
          <Link href="/community" className="btn btn-ghost mt-4">
            Topluluğa git
          </Link>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col divide-y divide-ink-700 overflow-hidden rounded-xl border border-ink-700 bg-ink-850/60">
          {notifications.map((notification) => (
            <li key={notification.id}>
              <div
                className={`flex items-start gap-3 p-4 transition-colors ${
                  notification.isRead
                    ? "hover:bg-ink-800/40"
                    : "bg-ink-800/40 hover:bg-ink-800/60"
                }`}
              >
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink-800 text-lg"
                  role="img"
                  aria-label={TYPE_LABELS[notification.type] ?? notification.type}
                >
                  {TYPE_ICONS[notification.type] ?? "🔔"}
                </span>

                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm ${
                      notification.isRead
                        ? "text-mist-300"
                        : "font-medium text-mist-100"
                    }`}
                  >
                    {notification.message}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[0.68rem] text-mist-500">
                    <span className="chip text-[0.62rem]">
                      {TYPE_LABELS[notification.type] ?? notification.type}
                    </span>
                    <span>{formatTime(notification.createdAt)}</span>
                    {notification.deepLink ? (
                      <button
                        onClick={() => {
                          if (!notification.isRead) void markRead(notification.id);
                          router.push(notification.deepLink!);
                        }}
                        className="text-gold-400 hover:underline"
                      >
                        Görüntüle →
                      </button>
                    ) : null}
                  </div>
                </div>

                {!notification.isRead ? (
                  <button
                    onClick={() => void markRead(notification.id)}
                    className="shrink-0 text-[0.68rem] text-mist-500 hover:text-gold-300 transition-colors"
                    title="Okundu işaretle"
                  >
                    <span className="flex h-2.5 w-2.5 items-center justify-center rounded-full bg-gold-500" />
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}