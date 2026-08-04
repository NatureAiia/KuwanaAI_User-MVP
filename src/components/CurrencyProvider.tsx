"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { CURRENCIES, convertCurrency, formatCurrency, getPerUsdMap, type CurrencyCode } from "@/lib/currency";

const STORAGE_KEY = "kuwana-currency";

type CurrencyContextValue = {
  currency: CurrencyCode;
  setCurrency: (code: CurrencyCode) => void;
  /** Converts + formats an amount from its listing currency into the user's preferred display currency. */
  display: (amount: number, listingCurrency: string) => string;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>("USD");
  const [liveRates, setLiveRates] = useState<Partial<Record<string, number>>>({});

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as CurrencyCode | null;
    if (stored && CURRENCIES.some((c) => c.code === stored)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a one-time user preference from localStorage, not deriving render output
      setCurrencyState(stored);
    }

    fetch("/api/fx-rates")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.rates) setLiveRates(data.rates);
      })
      .catch(() => {
        // Static defaults in lib/currency.ts already cover every currency —
        // a failed fetch here just means we stay on those, not a broken app.
      });
  }, []);

  function setCurrency(code: CurrencyCode) {
    setCurrencyState(code);
    localStorage.setItem(STORAGE_KEY, code);
  }

  function display(amount: number, listingCurrency: string) {
    const perUsdMap = getPerUsdMap(liveRates);
    return formatCurrency(convertCurrency(amount, listingCurrency, currency, perUsdMap), currency);
  }

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, display }}>{children}</CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
