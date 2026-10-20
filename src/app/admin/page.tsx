import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";

import { AppHeader } from "@/components/layout/app-header";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getOpenReportsCount } from "@/lib/community/reports";
import { getDb } from "@/lib/db";
import { franchises, titles, users } from "@/lib/db/schema";

export const metadata: Metadata = { title: "Yönetim" };

const PANEL_LINKS = [
  {
    href: "/moderation",
    title: "Moderasyon",
    description:
      "Topluluk şikayetlerini inceleyin; içerikleri gizleyin, kaldırın veya retorun.",
  },
  {
    href: "/franchises",
    title: "Franchise yönetimi",
    description:
      "Film/dizi evrenlerini oluşturun, silin ve yapımları franchise'lere bağlayın.",
  },
  {
    href: "/settings/data",
    title: "Veri yedekleme",
    description:
      "Kişisel sinema hafızanızı JSON/CSV olarak yedekleyin veya geri yükleyin.",
  },
  {
    href: "/reports/me",
    title: "Raporlarım",
    description: "Kendinizin açtığı şikayetlerin durumunu görün.",
  },
];

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isManager = user.role === "admin" || user.role === "moderator";
  if (!isManager) redirect("/");

  const db = getDb();
  const [userCountRow, titleCountRow, franchiseCountRow, openReports] =
    await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(users),
      db.select({ count: sql<number>`count(*)` }).from(titles),
      db.select({ count: sql<number>`count(*)` }).from(franchises),
      getOpenReportsCount(),
    ]);

  const stats = [
    { label: "Kullanıcı", value: Number(userCountRow[0]?.count ?? 0) },
    { label: "Yapım", value: Number(titleCountRow[0]?.count ?? 0) },
    { label: "Franchise", value: Number(franchiseCountRow[0]?.count ?? 0) },
    { label: "Açık şikayet", value: openReports },
  ];

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <p className="text-[0.68rem] uppercase tracking-[0.22em] text-gold-400">
          Yönetim
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">
          Yönetim Paneli
        </h1>
        <p className="muted mt-1">
          Bu panel yalnızca yöneticilere ve moderatörlere görünür.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="surface p-4 text-center">
              <p className="font-display text-2xl font-semibold text-gold-300">
                {stat.value}
              </p>
              <p className="label mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {PANEL_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="surface flex flex-col gap-1 transition-colors hover:border-gold-500/30"
            >
              <h2 className="font-display font-semibold text-mist-100">
                {link.title}
              </h2>
              <p className="text-sm text-mist-400">{link.description}</p>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
