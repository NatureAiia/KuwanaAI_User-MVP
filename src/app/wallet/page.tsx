"use client";

import { useEffect, useState } from "react";
import { BottomTabBar } from "@/components/BottomTabBar";
import { Header } from "@/components/Header";
import { Card, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type Currency = "USD" | "ZiG";

type Transaction = {
  id: string;
  reference: string;
  amount: string;
  currency: Currency;
  status: "initiated" | "pending" | "paid" | "cancelled" | "failed" | "refunded";
  createdAt: string;
};

const STATUS_TONE: Record<Transaction["status"], "neutral" | "sky" | "teal" | "coral"> = {
  initiated: "sky",
  pending: "sky",
  paid: "teal",
  cancelled: "coral",
  failed: "coral",
  refunded: "neutral",
};

export default function WalletPage() {
  const [balances, setBalances] = useState<{ usd: string; zig: string } | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadTransactions() {
    fetch("/api/wallet/transactions")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setTransactions(data.transactions ?? []);
        setBalances(data.balances ?? null);
      })
      .catch(() => {});
  }

  useEffect(() => {
    loadTransactions();
  }, []);

  async function submitTopUp() {
    setError(null);
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter a valid amount.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/wallet/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsedAmount, currency }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not start this payment.");
        setSubmitting(false);
        return;
      }
      // Full navigation, not client-side router — this leaves the app for Paynow's hosted page.
      window.location.href = data.redirectUrl;
    } catch {
      setError("Could not reach the payment gateway.");
      setSubmitting(false);
    }
  }

  return (
    <div id="main-content" tabIndex={-1} className="flex flex-1 flex-col px-5 pb-24 pt-6 md:px-10">
      <Header />
      <h1 className="mt-4 font-display text-[24px] font-bold">Wallet</h1>
      <p className="mt-1 text-[13px] text-text-secondary">Top up via Paynow — card, EcoCash, OneMoney and more.</p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Card>
          <p className="text-[11px] text-text-muted">USD balance</p>
          <p className="mt-1 font-mono text-[20px] font-semibold">${balances ? balances.usd : "…"}</p>
        </Card>
        <Card>
          <p className="text-[11px] text-text-muted">ZiG balance</p>
          <p className="mt-1 font-mono text-[20px] font-semibold">ZiG {balances ? balances.zig : "…"}</p>
        </Card>
      </div>

      <div className="mt-6 space-y-2.5">
        <h2 className="font-display text-[14px] font-semibold text-text-secondary">Top up</h2>
        <div className="flex gap-2">
          {(["USD", "ZiG"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCurrency(c)}
              className={`tap-target rounded-full border px-3.5 py-1.5 text-[13px] font-medium ${
                currency === c
                  ? "border-accent-sky bg-accent-sky/15 text-accent-sky"
                  : "border-border bg-bg-surface text-text-secondary"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
          className="w-full rounded-xl border border-border bg-bg-surface px-4 py-3 text-[14px] outline-none focus:border-accent-sky"
        />
        {error && <p className="text-[12px] text-accent-coral">{error}</p>}
        <Button onClick={submitTopUp} disabled={submitting} className="w-full">
          {submitting ? "Redirecting…" : `Top up ${currency}`}
        </Button>
      </div>

      <div className="mt-6 space-y-2.5">
        <h2 className="font-display text-[14px] font-semibold text-text-secondary">Recent top-ups</h2>
        {transactions.length === 0 && <p className="text-[13px] text-text-muted">No top-ups yet.</p>}
        <div className="flex flex-col gap-2">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between rounded-xl border border-border bg-bg-surface px-4 py-3"
            >
              <div>
                <p className="text-[13px] font-medium">
                  {tx.currency} {tx.amount}
                </p>
                <p className="text-[11px] text-text-muted">{new Date(tx.createdAt).toLocaleString()}</p>
              </div>
              <Badge tone={STATUS_TONE[tx.status]}>{tx.status}</Badge>
            </div>
          ))}
        </div>
      </div>

      <BottomTabBar />
    </div>
  );
}
