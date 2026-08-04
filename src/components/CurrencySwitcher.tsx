"use client";

import { clsx } from "clsx";
import { CURRENCIES } from "@/lib/currency";
import { useCurrency } from "@/components/CurrencyProvider";

export function CurrencySwitcher() {
  const { currency, setCurrency } = useCurrency();

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
        Approximate reference rates, for display only — not live market rates.
      </p>
    </div>
  );
}
