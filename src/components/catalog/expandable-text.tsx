"use client";

import { useState } from "react";

/**
 * Uzun metni varsayilan olarak kisaltir, "Devamini oku" ile acar.
 * Kunye karti boylece varsayilan olarak kompakt kalir.
 */
export function ExpandableText({
  text,
  lines = 4,
  className = "",
}: {
  text: string;
  lines?: number;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  // Kabaca: satir basina ~55 karakter sigiyor.
  const canExpand = text.length > lines * 55;

  return (
    <div className="min-w-0">
      <p
        className={`text-sm leading-relaxed text-mist-300 ${className}`}
        style={
          !expanded && canExpand
            ? {
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: lines,
                overflow: "hidden",
              }
            : undefined
        }
      >
        {text}
      </p>
      {canExpand ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="mt-1 text-[0.72rem] font-medium text-gold-400 transition-colors hover:text-gold-300"
        >
          {expanded ? "Daralt" : "Devamını oku"}
        </button>
      ) : null}
    </div>
  );
}
