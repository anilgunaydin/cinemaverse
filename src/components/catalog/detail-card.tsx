import type { ReactNode } from "react";

/**
 * Yapim detay sayfasindaki tum kartlar icin ortak iskelet.
 * Ayni baslik dili, ayni bosluklar ve grid satirinda esit yukseklik
 * davranisi (kart = flex kolon, govde = kalan alan) saglar.
 */

export type DetailIcon =
  | "plot"
  | "cast"
  | "rating"
  | "play"
  | "quote"
  | "thread"
  | "research"
  | "ai";

const ICONS: Record<DetailIcon, ReactNode> = {
  plot: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <path d="M7.5 4.5v15M16.5 4.5v15M3 9.5h4.5M3 14.5h4.5M16.5 9.5H21M16.5 14.5H21" />
    </>
  ),
  cast: (
    <>
      <circle cx="9" cy="8" r="3.1" />
      <path d="M3.6 19c0-2.9 2.4-4.7 5.4-4.7s5.4 1.8 5.4 4.7" />
      <path d="M15.8 5.5a3.1 3.1 0 0 1 0 5M17.4 14.7c1.9.5 3 2 3 4.3" />
    </>
  ),
  rating: (
    <path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.8l5.9-.9z" />
  ),
  play: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M10.4 9.3v5.4L15 12z" fill="currentColor" stroke="none" />
    </>
  ),
  quote: (
    <>
      <path d="M4 5.5h16v10a2 2 0 0 1-2 2h-6.6L7 21v-3.5H6a2 2 0 0 1-2-2z" />
      <path d="M8.4 9.5h7.2M8.4 13h4.4" />
    </>
  ),
  thread: (
    <>
      <path d="M20 6.5v7a2 2 0 0 1-2 2h-6.5L7 19v-3.5H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />
      <path d="M8 9.8h8M8 12.8h5" />
    </>
  ),
  research: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 4.5 4.5M8.4 10.5h4.2M10.5 8.4v4.2" />
    </>
  ),
  ai: (
    <>
      <path d="M12 3.5l1.6 4.1 4.1 1.6-4.1 1.6L12 15l-1.6-4.2L6.3 9.2l4.1-1.6z" />
      <path d="M17.8 14.5l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9z" />
    </>
  ),
};

export function CardTitle({
  icon,
  title,
  meta,
  action,
}: {
  icon?: DetailIcon;
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="flex shrink-0 items-center gap-2.5 border-b border-ink-700/60 px-4 py-2.5">
      {icon ? (
        <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-gold-500/20 bg-gold-500/10 text-gold-300">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {ICONS[icon]}
          </svg>
        </span>
      ) : null}
      <h2 className="min-w-0 truncate font-display text-[0.98rem] font-semibold leading-tight text-mist-100">
        {title}
      </h2>
      {meta ? (
        <span className="ml-auto shrink-0 truncate text-[0.68rem] text-mist-500">
          {meta}
        </span>
      ) : null}
      {action ? (
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {action}
        </div>
      ) : null}
    </header>
  );
}

export function DetailCard({
  id,
  icon,
  title,
  meta,
  action,
  className = "",
  bodyClassName = "",
  children,
}: {
  id?: string;
  icon?: DetailIcon;
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={`surface flex min-h-0 min-w-0 flex-col overflow-hidden transition-colors duration-200 hover:border-ink-500/70 ${className}`}
    >
      <CardTitle icon={icon} title={title} meta={meta} action={action} />
      <div
        className={`flex min-h-0 flex-1 flex-col p-4 ${bodyClassName}`}
      >
        {children}
      </div>
    </section>
  );
}
