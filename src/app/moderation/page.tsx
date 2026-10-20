import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/layout/app-header";
import { ReportList } from "@/components/community/moderation-panel";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listReports, getOpenReportsCount } from "@/lib/community/reports";

export const metadata: Metadata = { title: "Moderasyon Paneli" };

export default async function ModerationPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isModerator = user.role === "admin" || user.role === "moderator";
  if (!isModerator) redirect("/");

  const [openCount, reports] = await Promise.all([
    getOpenReportsCount(),
    listReports({ viewerId: user.id, isModerator: true, status: "open", limit: 50 }),
  ]);

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[0.68rem] uppercase tracking-[0.22em] text-gold-400">
              Yönetim
            </p>
            <h1 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">
              Moderasyon Paneli
            </h1>
          </div>
          {openCount > 0 && (
            <span className="chip chip-gold">
              {openCount} açık rapor
            </span>
          )}
        </div>

        <p className="muted mt-1">
          Topluluk raporlarını inceleyin ve içerik moderasyonu yapın.
        </p>

        <div className="mt-6">
          <ReportList initialReports={reports} isModerator={true} />
        </div>
      </main>
    </>
  );
}