"use client";

import { useState } from "react";

export function FollowButton({
  targetUserId,
  initialFollowing,
  initialFollowersCount,
  onUpdate,
}: {
  targetUserId: string;
  initialFollowing: boolean;
  initialFollowersCount: number;
  onUpdate?: (data: { following: boolean; followersCount: number }) => void;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [followersCount, setFollowersCount] = useState(initialFollowersCount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleFollow() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (following) {
        const response = await fetch(`/api/follows?targetUserId=${encodeURIComponent(targetUserId)}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          setError(data.error ?? "Takip bırakılamadı.");
          return;
        }
        setFollowing(false);
        setFollowersCount((c) => Math.max(0, c - 1));
      } else {
        const response = await fetch("/api/follows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetUserId }),
        });
        if (!response.ok) {
          const data = (await response.json()) as { error?: string; code?: string };
          if (data.code === "self_follow") {
            setError("Kendinizi takip edemezsiniz.");
          } else {
            setError(data.error ?? "Takip edilemedi.");
          }
          return;
        }
        setFollowing(true);
        setFollowersCount((c) => c + 1);
      }
      onUpdate?.({ following: !following, followersCount: following ? followersCount - 1 : followersCount + 1 });
    } catch {
      setError("Ağ hatası: işlem yapılamadı.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className={`btn ${following ? "btn-ghost" : "btn-primary"} flex items-center gap-1.5`}
        onClick={toggleFollow}
        disabled={busy}
      >
        {busy ? (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 5v14M17 10H7M7 10l5 5M7 10l5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
            {following ? "Takip ediliyor" : "Takip et"}
          </>
        )}
      </button>
      {error ? (
        <span className="text-xs text-rose-400">{error}</span>
      ) : null}
    </div>
  );
}

export function BlockButton({
  targetUserId,
  initialBlocked,
  onUpdate,
}: {
  targetUserId: string;
  initialBlocked: boolean;
  onUpdate?: (blocked: boolean) => void;
}) {
  const [blocked, setBlocked] = useState(initialBlocked);
  const [busy, setBusy] = useState(false);

  async function toggleBlock() {
    if (busy) return;
    if (!window.confirm(blocked ? "Engellemeyi kaldırmak istediğinize emin misiniz?" : "Bu kullanıcıyı engellemek istediğinize emin misiniz? Engellenen kullanıcı sizi takip edemez, mesaj gönderemez ve içeriğinizi göremez.")) {
      return;
    }
    setBusy(true);
    try {
      if (blocked) {
        const response = await fetch(`/api/blocks?targetUserId=${encodeURIComponent(targetUserId)}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          alert(data.error ?? "Engelleme kaldırılamadı.");
          return;
        }
        setBlocked(false);
      } else {
        const response = await fetch("/api/blocks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetUserId }),
        });
        if (!response.ok) {
          const data = (await response.json()) as { error?: string; code?: string };
          if (data.code === "self_block") {
            alert("Kendinizi engelleyemezsiniz.");
          } else {
            alert(data.error ?? "Engellenemedi.");
          }
          return;
        }
        setBlocked(true);
      }
      onUpdate?.(!blocked);
    } catch {
      alert("Ağ hatası: işlem yapılamadı.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={`btn btn-ghost text-xs ${blocked ? "text-rose-400" : ""}`}
      onClick={toggleBlock}
      disabled={busy}
    >
      {busy ? "İşleniyor…" : blocked ? "Engeli kaldır" : "Engelle"}
    </button>
  );
}

export function MuteButton({
  targetUserId,
  initialMuted,
  onUpdate,
}: {
  targetUserId: string;
  initialMuted: boolean;
  onUpdate?: (muted: boolean) => void;
}) {
  const [muted, setMuted] = useState(initialMuted);
  const [busy, setBusy] = useState(false);

  async function toggleMute() {
    if (busy) return;
    setBusy(true);
    try {
      if (muted) {
        const response = await fetch(`/api/mutes?targetUserId=${encodeURIComponent(targetUserId)}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          alert(data.error ?? "Sessize alma kaldırılamadı.");
          return;
        }
        setMuted(false);
      } else {
        const response = await fetch("/api/mutes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetUserId }),
        });
        if (!response.ok) {
          const data = (await response.json()) as { error?: string; code?: string };
          if (data.code === "self_mute") {
            alert("Kendinizi sessize alamazsınız.");
          } else {
            alert(data.error ?? "Sessize alınamadı.");
          }
          return;
        }
        setMuted(true);
      }
      onUpdate?.(!muted);
    } catch {
      alert("Ağ hatası: işlem yapılamadı.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={`btn btn-ghost text-xs ${muted ? "text-amber-400" : ""}`}
      onClick={toggleMute}
      disabled={busy}
    >
      {busy ? "İşleniyor…" : muted ? "Sessize almayı kaldır" : "Sessize al"}
    </button>
  );
}