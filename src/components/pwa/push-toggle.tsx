"use client";

import { usePushNotifications } from "@/hooks/usePushNotifications";

export function PushToggle() {
  const { supported, permission, subscribed, loading, subscribe, unsubscribe } =
    usePushNotifications();

  if (!supported) return null;

  const handleToggle = async () => {
    if (subscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  return (
    <div className="flex items-center justify-between rounded-lg border border-ink-700 bg-ink-850/80 p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-gold-500/20 text-gold-300">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </span>
        <div>
          <p className="font-medium text-mist-100">Push Bildirimleri</p>
          <p className="text-sm text-mist-500">
            {permission === "granted"
              ? "Yeni inceleme, takip, AI öneri için bildirim al"
              : permission === "denied"
              ? "Engellenmiş — tarayıcı ayarlarından izin verin"
              : "İzin verilirse bildirimler aktif olur"}
          </p>
        </div>
      </div>

      <button
        onClick={handleToggle}
        disabled={loading}
        className={`btn transition-colors ${
          subscribed
            ? "btn-ghost text-jade-400 hover:bg-jade-500/10"
            : "btn-primary"
        }`}
      >
        {loading
          ? "İşleniyor…"
          : subscribed
          ? "Aktif — Kapat"
          : permission === "denied"
          ? "İzin Ver (Ayarlar)"
          : "Aktif Et"}
      </button>
    </div>
  );
}