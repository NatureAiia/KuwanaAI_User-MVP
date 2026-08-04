"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { CURRENCIES, convertCurrency, formatCurrency, type CurrencyCode } from "@/lib/currency";

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

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as CurrencyCode | null;
    if (stored && CURRENCIES.some((c) => c.code === stored)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a one-time user preference from localStorage, not deriving render output
      setCurrencyState(stored);
    }
  }, []);

  function setCurrency(code: CurrencyCode) {
    setCurrencyState(code);
    localStorage.setItem(STORAGE_KEY, code);
  }

  function display(amount: number, listingCurrency: string) {
    return formatCurrency(convertCurrency(amount, listingCurrency, currency), currency);
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
