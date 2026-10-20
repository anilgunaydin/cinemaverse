import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppHeader } from "@/components/layout/app-header";
import { ListDetail } from "@/components/community/list-detail";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getListDetail } from "@/lib/community/lists";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const list = await getListDetail(id);
  return { title: list ? list.name : "Liste bulunamadı" };
}

export default async function ListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const list = await getListDetail(id, user?.id ?? null);
  if (!list) notFound();

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-4 flex items-center gap-2 text-xs text-mist-500">
          <Link href="/lists" className="hover:text-mist-300">
            Listeler
          </Link>
          <span aria-hidden="true">/</span>
          <span className="truncate text-mist-400">{list.name}</span>
        </div>

        <ListDetail
          list={list}
          viewerId={user?.id ?? null}
        />
      </main>
    </>
  );
}