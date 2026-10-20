"use client";

import { useState } from "react";

/**
 * Tek satira sigmayan isim listesi (oyuncu kadrosu vb.).
 * Satira sigmiyorsa fare ile gelince tam liste tooltip olarak gosterilir.
 */
export function InlineNameList({
  names,
  label,
  maxChars = 120,
}: {
  names: string[];
  label: string;
  maxChars?: number;
}) {
  const [open, setOpen] = useState(false);

  if (names.length === 0) return null;

  const full = names.join(", ");
  const isTruncated = full.length > maxChars;
  const short = isTruncated
    ? `${full.slice(0, maxChars).trimEnd()}…`
    : full;

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <p
        className={`text-sm leading-snug text-mist-300 ${
          isTruncated ? "cursor-help truncate" : ""
        }`}
        title={isTruncated ? full : undefined}
        tabIndex={isTruncated ? 0 : undefined}
        aria-label={
          isTruncated ? `${label}: ${full}` : undefined
        }
      >
        {short}
      </p>

      {isTruncated && open ? (
        <div
          role="tooltip"
          className="absolute left-0 top-full z-40 mt-1 w-72 rounded-lg border border-ink-600 bg-ink-950 p-3 text-xs leading-relaxed text-mist-200 shadow-xl"
        >
          <p className="mb-1 font-semibold text-gold-300">{label}</p>
          <p>{full}</p>
        </div>
      ) : null}
    </div>
  );
}
