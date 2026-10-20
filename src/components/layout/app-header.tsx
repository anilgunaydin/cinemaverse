import Link from "next/link";
import { Suspense } from "react";

import { getCurrentUser } from "@/lib/auth/current-user";
import { LogoutButton } from "@/components/auth/logout-button";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NotificationBell } from "@/components/notifications/NotificationBell";

// Sade menu: benzer isler tek menude. Tartismalar/Lisiteler Topluluk,
// Franchise'ler Keshfet sayfasindan kisayolarla acilir.
const BASE_NAV_ITEMS = [
  { href: "/", label: "Keşfet" },
  { href: "/library", label: "Kütüphanem" },
  { href: "/recommendations", label: "Öneriler" },
  { href: "/community", label: "Topluluk" },
];

const MANAGER_NAV_ITEMS = [{ href: "/admin", label: "Yönetim" }];

export async function AppHeader() {
  const user = await getCurrentUser();
  const isManager = user?.role === "admin" || user?.role === "moderator";
  const navItems = isManager
    ? [...BASE_NAV_ITEMS, ...MANAGER_NAV_ITEMS]
    : BASE_NAV_ITEMS;

  return (
    <header className="sticky top-0 z-40 border-b border-ink-700/70 bg-ink-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-gold-500/40 bg-gradient-to-br from-gold-500/25 to-ink-900 text-gold-300">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 6h16v12H4z M8 6v12 M16 6v12 M4 10h4 M16 10h4 M4 14h4 M16 14h4"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-display text-[1.05rem] font-semibold tracking-tight text-mist-100">
              CinemaVerse
            </span>
            <span className="text-[0.62rem] uppercase tracking-[0.22em] text-mist-500">
              Sinema Hafızası
            </span>
          </span>
        </Link>

        <nav className="ml-6 hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-mist-300 transition-colors hover:bg-ink-800 hover:text-mist-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/search"
            className="hidden items-center gap-2 rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-mist-400 transition-colors hover:border-ink-500 hover:text-mist-200 sm:flex"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6" />
              <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            Yapım ara
          </Link>
          <Suspense fallback={<div className="h-9 w-24" />}>
            <HeaderUser />
          </Suspense>
          {user ? <NotificationBell /> : null}
          <MobileNav items={navItems} />
        </div>
      </div>
    </header>
  );
}

async function HeaderUser() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/login" className="btn btn-ghost">
          Giriş
        </Link>
        <Link href="/register" className="btn btn-primary hidden sm:inline-flex">
          Kayıt ol
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/profile"
        className="hidden items-center gap-2 rounded-lg border border-ink-600 bg-ink-900 px-2.5 py-1.5 text-sm text-mist-200 transition-colors hover:border-ink-500 sm:flex"
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-gold-500/20 text-[0.7rem] font-bold text-gold-300">
          {user.displayName.slice(0, 1).toLocaleUpperCase("tr")}
        </span>
        <span className="max-w-28 truncate">{user.displayName}</span>
      </Link>
      <LogoutButton />
    </div>
  );
}
