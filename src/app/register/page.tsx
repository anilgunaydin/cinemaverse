import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "Kayıt ol" };

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect("/library");

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="surface animate-fade-up p-6 sm:p-8">
        <p className="text-[0.68rem] uppercase tracking-[0.22em] text-gold-400">
          CinemaVerse
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold">Sinema hafızanızı başlatın</h1>
        <p className="muted mt-1 mb-6">
          Kütüphaneniz varsayılan olarak yalnızca size görünür.
        </p>
        <AuthForm mode="register" />
      </div>
      <Link href="/" className="mt-4 text-center text-sm text-mist-400 hover:text-mist-200">
        ← Keşfet sayfasına dön
      </Link>
    </main>
  );
}
