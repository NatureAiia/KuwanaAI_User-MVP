"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Wraps a server-rendered table/list. Rows tagged with `data-search-row`
 * are shown/hidden client-side by matching their text content against the
 * query, so no data-fetching changes are needed in the section itself.
 */
export function SearchableSection({
  placeholder = "Search…",
  rowSelector = "[data-search-row]",
  children,
}: {
  placeholder?: string;
  rowSelector?: string;
  children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [counts, setCounts] = useState({ visible: 0, total: 0 });

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const rows = container.querySelectorAll<HTMLElement>(rowSelector);
    const needle = debounced.trim().toLowerCase();
    let visible = 0;
    rows.forEach((row) => {
      const text = row.textContent?.toLowerCase() ?? "";
      const match = needle === "" || text.includes(needle);
      row.style.display = match ? "" : "none";
      if (match) visible++;
    });
    setCounts({ visible, total: rows.length });
  }, [debounced, rowSelector, children]);

  return (
    <div>
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-full border border-border bg-bg-surface py-2 pl-9 pr-8 text-[13px] outline-none focus:border-accent-sky"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
            >
              ✕
            </button>
          )}
        </div>
        {query && (
          <span className="whitespace-nowrap text-[12px] text-text-muted">
            {counts.visible} of {counts.total}
          </span>
        )}
      </div>
      <div ref={containerRef} className="mt-3">
        {children}
      </div>
    </div>
  );
}
