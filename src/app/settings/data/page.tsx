import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/layout/app-header";
import { DataTransferPanel } from "@/components/settings/data-transfer-panel";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "Veri yönetimi" };

export default async function SettingsDataPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-5 flex items-center gap-2 text-xs text-mist-500">
          <Link href="/library" className="hover:text-mist-300">
            Kütüphanem
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-mist-400">Veri yönetimi</span>
        </div>

        <h1 className="font-display text-2xl font-semibold sm:text-3xl">
          Veri yönetimi
        </h1>
        <p className="muted mt-1">
          Kişisel sinema hafızanızı yedekleyin veya başka bir cihazdan geri
          yükleyin. Verileriniz yalnızca bu cihazdaki yerel veritabanında
          tutulur.
        </p>

        <div className="mt-5">
          <DataTransferPanel
            displayName={user.displayName}
            exportedAtHint={new Date().toLocaleString("tr-TR")}
          />
        </div>
      </main>
    </>
  );
}
