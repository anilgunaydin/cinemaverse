import type { Metadata } from "next";

import { AppHeader } from "@/components/layout/app-header";
import { SearchPanel } from "@/components/search/search-panel";

export const metadata: Metadata = { title: "Yapım ara" };

export default function SearchPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <p className="text-[0.68rem] uppercase tracking-[0.22em] text-gold-400">
            Katalog
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">
            Film ve dizi ara
          </h1>
          <p className="muted mt-1">
            Arama sonuçları gerçek kaynaklardan gelir. Bir yapımı kütüphanenize
            eklediğinizde detayları kaydedilir.
          </p>
        </div>
        <SearchPanel autoFocus />
      </main>
    </>
  );
}
