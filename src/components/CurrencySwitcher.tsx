"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { CURRENCIES } from "@/lib/currency";
import { useCurrency } from "@/components/CurrencyProvider";

const RBZ_RATES_URL = "https://www.rbz.co.zw/index.php/research/markets/exchange-rates";

export function CurrencySwitcher() {
  const { currency, setCurrency } = useCurrency();
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/fx-rates")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.fetchedAt && setFetchedAt(d.fetchedAt))
      .catch(() => {});
  }, []);

  return (
    <div>
      <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-bg-surface p-2">
        {CURRENCIES.map((c) => (
          <button
            key={c.code}
            type="button"
            onClick={() => setCurrency(c.code)}
            aria-pressed={currency === c.code}
            className={clsx(
              "tap-target flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold",
              currency === c.code
                ? "bg-accent-sky text-[var(--text-on-accent-sky)]"
                : "text-text-secondary hover:bg-bg-surface-raised",
            )}
          >
            <span aria-hidden>{c.flag}</span>
            {c.code}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] text-text-muted">
        Approximate reference rates, for display only — not live market rates.{" "}
        <a
          href={RBZ_RATES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-teal underline underline-offset-2 hover:text-text-primary"
        >
          RBZ daily rate
        </a>
        {fetchedAt && (
          <span>
            {" "}· last updated {new Date(fetchedAt).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        )}
      </p>
    </div>
  );
}
