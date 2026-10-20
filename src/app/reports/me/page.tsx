import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/layout/app-header";
import { ReportList } from "@/components/community/moderation-panel";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listReports } from "@/lib/community/reports";

export const metadata: Metadata = { title: "Raporlarım" };

export default async function MyReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { status } = await searchParams;
  const statusFilter = status as "open" | "resolved" | "dismissed" | undefined;

  const reports = await listReports({
    viewerId: user.id,
    isModerator: false,
    status: statusFilter,
    limit: 50,
  });

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <p className="text-[0.68rem] uppercase tracking-[0.22em] text-gold-400">
          Profil
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">
          Raporlarım
        </h1>
        <p className="muted mt-1">
          Gönderdiğiniz raporların durumu.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href="/reports/me"
            className={`btn ${statusFilter === "open" || !statusFilter ? "btn-primary" : "btn-ghost"}`}
          >
            Açık
          </a>
          <a
            href="/reports/me?status=resolved"
            className={`btn ${statusFilter === "resolved" ? "btn-primary" : "btn-ghost"}`}
          >
            Çözüldü
          </a>
          <a
            href="/reports/me?status=dismissed"
            className={`btn ${statusFilter === "dismissed" ? "btn-primary" : "btn-ghost"}`}
          >
            Reddedildi
          </a>
        </div>

        <div className="mt-6">
          <ReportList initialReports={reports} isModerator={false} />
        </div>
      </main>
    </>
  );
}