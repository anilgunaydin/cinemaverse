"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Notification = {
  id: string;
  type: string;
  message: string;
  deepLink: string | null;
  isRead: boolean;
  createdAt: string;
};

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=10");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (e) {
      console.error("Failed to fetch notifications:", e);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    // Poll every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleToggle = () => setOpen((prev) => !prev);

  const handleMarkRead = async (id: string) => {
    try {
      await fetch("/api/notifications/read", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (e) {
      console.error("Failed to mark read:", e);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch("/api/notifications/read", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error("Failed to mark all read:", e);
    }
  };

  const handleClick = (notification: Notification) => {
    if (notification.deepLink) {
      if (!notification.isRead) {
        handleMarkRead(notification.id);
      }
      router.push(notification.deepLink);
    }
    setOpen(false);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Az önce";
    if (diffMins < 60) return `${diffMins} dk önce`;
    if (diffHours < 24) return `${diffHours} sa önce`;
    if (diffDays < 7) return `${diffDays} gün önce`;
    return date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "follow": return "👤";
      case "review": return "✍️";
      case "review_reply": return "💬";
      case "report": return "🚨";
      case "mention": return "📌";
      case "system": return "⚙️";
      default: return "🔔";
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        if (buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
          setOpen(false);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="relative p-2 rounded-lg text-mist-400 hover:text-mist-100 hover:bg-ink-800 transition-colors"
        aria-label="Bildirimler"
        aria-expanded={open}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={dropdownRef}
          className="absolute right-0 mt-2 w-80 origin-top-right rounded-xl border border-ink-700 bg-ink-900 shadow-xl animate-fade-in z-50"
          role="menu"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-ink-700">
            <h3 className="font-semibold text-mist-100">Bildirimler</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={async () => {
                    try {
                      await fetch("/api/notifications/read", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ markAllRead: true }),
                      });
                    } catch (e) {
                      console.error("Failed to mark all read:", e);
                    }
                  }}
                  className="text-xs text-gold-400 hover:underline"
                >
                  Tümünü okundu yap
                </button>
              )}
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-mist-500">
                <p className="font-medium text-mist-300">Bildirim yok</p>
                <p className="text-sm mt-1">Yeni bir etkileşim olduğunda burada görünür.</p>
              </div>
            ) : (
              <ul className="divide-y divide-ink-700" role="list">
                {notifications.map((notification) => (
                  <li key={notification.id} role="menuitem">
                    <button
                      onClick={() => handleClick(notification)}
                      className={`w-full px-4 py-3 text-left transition-colors ${
                        !notification.isRead
                          ? "bg-ink-800/50"
                          : "hover:bg-ink-800/50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-lg mt-0.5" role="img" aria-label={notification.type}>
                          {getTypeIcon(notification.type)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${!notification.isRead ? "font-medium text-mist-100" : "text-mist-300"}`}>
                            {notification.message}
                          </p>
                          <p className="text-[0.65rem] text-mist-500 mt-1">
                            {formatTime(notification.createdAt)}
                          </p>
                        </div>
                        {!notification.isRead && (
                          <span className="flex h-2 w-2 items-center justify-center rounded-full bg-gold-500" />
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="px-4 py-3 border-t border-ink-700">
            <Link
              href="/notifications"
              className="block w-full text-center text-sm text-gold-400 hover:text-gold-300 transition-colors"
              onClick={() => setOpen(false)}
            >
              Tüm bildirimleri gör
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function getTypeIcon(type: string) {
  switch (type) {
    case "follow": return "👤";
    case "review": return "✍️";
    case "review_reply": return "💬";
    case "report": return "🚨";
    case "mention": return "📌";
    case "system": return "⚙️";
    default: return "🔔";
  }
}

function formatTime(dateString: string) {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (mins < 1) return "Az önce";
  if (mins < 60) return `${mins} dk önce`;
  if (hours < 24) return `${hours} sa önce`;
  if (days < 7) return `${days} gün önce`;
  return new Date(dateString).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}