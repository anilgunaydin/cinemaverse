"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Mode = "login" | "register";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
    const payload =
      mode === "login"
        ? {
            email: String(formData.get("email") ?? ""),
            password: String(formData.get("password") ?? ""),
          }
        : {
            email: String(formData.get("email") ?? ""),
            password: String(formData.get("password") ?? ""),
            displayName: String(formData.get("displayName") ?? ""),
          };

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        details?: { path: string; message: string }[];
      };

      if (!response.ok) {
        setError(data.error ?? "İşlem tamamlanamadı.");
        if (data.details) {
          const mapped: Record<string, string> = {};
          for (const detail of data.details) {
            mapped[detail.path] = detail.message;
          }
          setFieldErrors(mapped);
        }
        return;
      }

      router.push("/library");
      router.refresh();
    } catch {
      setError("Sunucuya ulaşılamadı. Bağlantınızı kontrol edin.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {mode === "register" ? (
        <div>
          <label htmlFor="displayName" className="label">
            Görünen ad
          </label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            required
            minLength={2}
            maxLength={60}
            autoComplete="nickname"
            className="field"
            placeholder="Örn. SinemaSever"
          />
          {fieldErrors.displayName ? (
            <p className="mt-1 text-xs text-rose-400">{fieldErrors.displayName}</p>
          ) : null}
        </div>
      ) : null}

      <div>
        <label htmlFor="email" className="label">
          E-posta
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="field"
          placeholder="ornek@eposta.com"
        />
        {fieldErrors.email ? (
          <p className="mt-1 text-xs text-rose-400">{fieldErrors.email}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="password" className="label">
          Şifre
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={mode === "register" ? 8 : 1}
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          className="field"
          placeholder={mode === "register" ? "En az 8 karakter" : "••••••••"}
        />
        {fieldErrors.password ? (
          <p className="mt-1 text-xs text-rose-400">{fieldErrors.password}</p>
        ) : null}
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-400"
        >
          {error}
        </div>
      ) : null}

      <button type="submit" disabled={pending} className="btn btn-primary mt-1 w-full py-2.5">
        {pending ? "İşleniyor…" : mode === "login" ? "Giriş yap" : "Hesap oluştur"}
      </button>

      <p className="text-center text-sm text-mist-400">
        {mode === "login" ? (
          <>
            Hesabınız yok mu?{" "}
            <Link href="/register" className="text-gold-300 hover:underline">
              Kayıt olun
            </Link>
          </>
        ) : (
          <>
            Zaten hesabınız var mı?{" "}
            <Link href="/login" className="text-gold-300 hover:underline">
              Giriş yapın
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
