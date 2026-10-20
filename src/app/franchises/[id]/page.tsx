import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppHeader } from "@/components/layout/app-header";
import { FranchiseDetail } from "@/components/community/franchise-detail";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getFranchiseDetail } from "@/lib/community/franchises";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const franchise = await getFranchiseDetail(id);
  return { title: franchise ? franchise.name : "Franchise bulunamadı" };
}

export default async function FranchisePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const isModerator = user?.role === "admin" || user?.role === "moderator";
  const franchise = await getFranchiseDetail(id);
  if (!franchise) notFound();

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-4 flex items-center gap-2 text-xs text-mist-500">
          <Link href="/franchises" className="hover:text-mist-300">
            Franchise&apos;ler
          </Link>
          <span aria-hidden="true">/</span>
          <span className="truncate text-mist-400">{franchise.name}</span>
        </div>

        <FranchiseDetail
          franchise={franchise}
          isModerator={isModerator}
        />
      </main>
    </>
  );
}