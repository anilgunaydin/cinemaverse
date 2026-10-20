import type { Metadata } from "next";

import { AppHeader } from "@/components/layout/app-header";
import { FranchiseForm, FranchiseGrid } from "@/components/community/franchise-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listFranchises } from "@/lib/community/franchises";

export const metadata: Metadata = { title: "Franchise'ler" };

export default async function FranchisesPage() {
  const user = await getCurrentUser();
  const isModerator = user?.role === "admin" || user?.role === "moderator";
  const franchises = await listFranchises(50);

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <p className="text-[0.68rem] uppercase tracking-[0.22em] text-gold-400">
          Keşfet
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">
          Film/Dizi Evrenleri (Franchise&apos;ler)
        </h1>
        <p className="muted mt-1">
          İlgili film ve dizilerin gruplandırıldığı evrenler/franchise&apos;ler.
          Sıralama yapım yılına göre yapılır.
        </p>

        {isModerator ? (
          <div className="mt-6 surface p-4 sm:p-5">
            <h2 className="section-title">Yeni franchise oluştur</h2>
            <FranchiseForm />
          </div>
        ) : null}

        <div className="mt-6">
          <FranchiseGrid
            franchises={franchises}
            isModerator={isModerator}
            emptyMessage="Henüz franchise yok. Moderatörler yukarıdan oluşturabilir."
          />
        </div>
      </main>
    </>
  );
}