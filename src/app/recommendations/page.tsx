import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/layout/app-header";
import { GenerateButton } from "@/components/recommendations/generate-button";
import { RecommendationList } from "@/components/recommendations/recommendation-list";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  generateRecommendations,
  listRecommendationViews,
} from "@/lib/recommendations/service";
import { getLibraryStats } from "@/lib/library/service";

export const metadata: Metadata = { title: "Öneriler" };

export default async function RecommendationsPage({
  searchParams,
}: {
  searchParams: Promise<{ generate?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { generate } = await searchParams;
  const stats = await getLibraryStats(user.id);

  let items = await listRecommendationViews(user.id);
  let profile: {
    ratedCount: number;
    ratingMean: number | null;
    confidence: number;
  } | null = null;
  let notices: string[] = [];

  // Ilk ziyarette veya acikca istendiginde yeniden hesapla.
  if (items.length === 0 || generate === "1") {
    const outcome = await generateRecommendations(user.id);
    profile = outcome.profile;
    notices = outcome.reasonsWithoutData;
    items = await listRecommendationViews(user.id);
  }

  const safe = items.filter((item) => item.kind === "safe");
  const discovery = items.filter((item) => item.kind === "discovery");

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[0.68rem] uppercase tracking-[0.22em] text-gold-400">
              Kişiselleştirme
            </p>
            <h1 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">
              Size uygun olabilecek yapımlar
            </h1>
            <p className="muted mt-1 max-w-2xl">
              Öneriler yalnızca sizin puanlarınıza ve kayıtlarınıza dayanır.
              İzlediğiniz yapımlar yeniden önerilmez; her önerinin gerekçesi ve
              belirsizlik düzeyi gösterilir.
            </p>
          </div>
          <GenerateButton />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="surface-flat p-3">
            <p className="text-[0.65rem] uppercase tracking-wider text-mist-500">
              Puanladığınız yapım
            </p>
            <p className="text-xl font-semibold text-mist-100">
              {profile?.ratedCount ?? stats.ratedCount}
            </p>
          </div>
          <div className="surface-flat p-3">
            <p className="text-[0.65rem] uppercase tracking-wider text-mist-500">
              Ortalama puanınız
            </p>
            <p className="text-xl font-semibold text-mist-100">
              {profile?.ratingMean !== undefined && profile?.ratingMean !== null
                ? `${profile.ratingMean.toFixed(1)}/10`
                : stats.averageRating !== null
                  ? `${stats.averageRating.toFixed(1)}/10`
                  : "—"}
            </p>
          </div>
          <div className="surface-flat p-3">
            <p className="text-[0.65rem] uppercase tracking-wider text-mist-500">
              Profil güveni
            </p>
            <p className="text-xl font-semibold text-mist-100">
              %{Math.round((profile?.confidence ?? 0) * 100)}
            </p>
            <p className="mt-0.5 text-[0.68rem] text-mist-500">
              Puan sayısı arttıkça yükselir
            </p>
          </div>
        </div>

        {notices.length > 0 ? (
          <div className="mt-4 rounded-lg border border-gold-500/35 bg-gold-500/5 px-3 py-3">
            {notices.map((notice) => (
              <p key={notice} className="text-sm text-gold-300">
                {notice}
              </p>
            ))}
            <Link href="/search" className="btn btn-ghost mt-2.5">
              Yapım ekle
            </Link>
          </div>
        ) : null}

        <section className="mt-7">
          <div className="flex items-center gap-2">
            <h2 className="section-title">Güvenli öneriler</h2>
            <span className="chip chip-jade">{safe.length}</span>
          </div>
          <p className="muted mb-3 mt-0.5">
            Tercih profilinizle güçlü uyum gösteren yapımlar.
          </p>
          <RecommendationList
            items={safe}
            emptyMessage="Henüz güvenli öneri yok. Birkaç yapımı puanlayıp yeniden oluşturun."
          />
        </section>

        <section className="mt-7">
          <div className="flex items-center gap-2">
            <h2 className="section-title">Keşif önerileri</h2>
            <span className="chip chip-gold">{discovery.length}</span>
          </div>
          <p className="muted mb-3 mt-0.5">
            Alıştığınız çizginin biraz dışında, yine de makul bulunan yapımlar.
            Bu öneriler daha yüksek belirsizlik taşır.
          </p>
          <RecommendationList
            items={discovery}
            emptyMessage="Keşif önerisi bulunmuyor."
          />
        </section>
      </main>
    </>
  );
}
