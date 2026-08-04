"use client";

import { useCurrency } from "@/components/CurrencyProvider";

export function FormattedPrice({ amount, currency }: { amount: number; currency: string }) {
  const { display } = useCurrency();
  return <>{display(amount, currency)}</>;
}
