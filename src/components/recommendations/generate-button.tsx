"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GenerateButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/recommendations", { method: "POST" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Öneriler üretilemedi.");
        return;
      }
      router.refresh();
    } catch {
      setError("Sunucuya ulaşılamadı.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleGenerate}
        disabled={pending}
        className="btn btn-primary"
      >
        {pending ? "Hesaplanıyor…" : "Önerileri oluştur"}
      </button>
      {error ? <p className="text-xs text-rose-400">{error}</p> : null}
    </div>
  );
}
