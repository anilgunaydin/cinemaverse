"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };

/**
 * Mobil gezinme menusu. Rota degistiginde menunun kapanmasi icin ic bilesen
 * pathname ile anahtarlanir; boylece state sifirlanir ve efekt gerekmez.
 */
export function MobileNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return <MobileNavInner key={pathname} items={items} />;
}

function MobileNavInner({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        className="btn btn-ghost px-2.5"
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label="Menüyü aç"
        onClick={() => setOpen((value) => !value)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          {open ? (
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          )}
        </svg>
      </button>

      {open ? (
        <div
          id="mobile-nav"
          className="surface absolute left-3 right-3 top-16 z-50 animate-fade-up p-2"
        >
          <nav className="flex flex-col">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-mist-200 hover:bg-ink-800"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/search"
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-mist-200 hover:bg-ink-800"
            >
              Yapım ara
            </Link>
            <Link
              href="/profile"
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-mist-200 hover:bg-ink-800"
            >
              Profil
            </Link>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
