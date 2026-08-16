"use client";

import { useEffect, useState } from "react";
import { BottomTabBar } from "@/components/BottomTabBar";
import { Header } from "@/components/Header";
import { BackButton } from "@/components/ui/BackButton";
import { Card, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Receipt } from "lucide-react";

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

type MobileMethod = "ecocash" | "onemoney" | "innbucks";

const MOBILE_METHODS: { value: MobileMethod; label: string }[] = [
  { value: "ecocash", label: "EcoCash" },
  { value: "onemoney", label: "OneMoney" },
  { value: "innbucks", label: "InnBucks" },
];

export default function WalletPage() {
  const [balances, setBalances] = useState<{ usd: string; zig: string } | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<"redirect" | "mobile">("redirect");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<MobileMethod>("ecocash");
  const [mobileNotice, setMobileNotice] = useState<string | null>(null);
  const [mobileReference, setMobileReference] = useState<string | null>(null);

  function loadTransactions() {
    fetch("/api/wallet/transactions")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const nextTransactions: Transaction[] = data.transactions ?? [];
        setTransactions(nextTransactions);
        setBalances(data.balances ?? null);

        // Once a polled mobile-money top-up resolves, drop the "check your
        // phone" notice — there's no browser return step to catch this like
        // the redirect flow has, so this poll loop is the only thing that will.
        setMobileReference((ref) => {
          if (!ref) return ref;
          const tx = nextTransactions.find((t) => t.reference === ref);
          if (tx && tx.status !== "pending" && tx.status !== "initiated") {
            setMobileNotice(null);
            return null;
          }
          return ref;
        });
      })
      .catch(() => {});
  }

  useEffect(() => {
    loadTransactions();
  }, []);

  useEffect(() => {
    if (!mobileReference) return;
    const interval = setInterval(loadTransactions, 4000);
    return () => clearInterval(interval);
  }, [mobileReference]);

  async function submitTopUp() {
    setError(null);
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter a valid amount.");
      return;
    }

    if (mode === "mobile" && !/^\d{9,15}$/.test(phone.trim())) {
      setError("Enter a valid mobile number, digits only.");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "redirect") {
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
        return;
      }

      const res = await fetch("/api/wallet/topup/express", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsedAmount, currency, phone: phone.trim(), method }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not start this payment.");
        setSubmitting(false);
        return;
      }
      setMobileNotice(data.instructions ?? "Check your phone to authorize the payment.");
      setMobileReference(data.reference ?? null);
      loadTransactions();
    } catch {
      setError("Could not reach the payment gateway.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div id="main-content" tabIndex={-1} className="flex flex-1 flex-col px-5 pb-24 pt-6 md:px-10">
      <Header />
      <div className="mt-4 flex items-center gap-2">
        <BackButton />
        <h1 className="font-display text-[24px] font-bold">Wallet</h1>
      </div>
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

        <div className="flex gap-2">
          {(
            [
              { value: "redirect", label: "Card / Paynow page" },
              { value: "mobile", label: "Mobile money" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMode(opt.value)}
              className={`tap-target rounded-full border px-3.5 py-1.5 text-[13px] font-medium ${
                mode === opt.value
                  ? "border-accent-sky bg-accent-sky/15 text-accent-sky"
                  : "border-border bg-bg-surface text-text-secondary"
              }`}
            >
              {opt.label}
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

        {mode === "mobile" && (
          <>
            <div className="flex gap-2">
              {MOBILE_METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMethod(m.value)}
                  className={`tap-target rounded-full border px-3.5 py-1.5 text-[13px] font-medium ${
                    method === m.value
                      ? "border-accent-sky bg-accent-sky/15 text-accent-sky"
                      : "border-border bg-bg-surface text-text-secondary"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Mobile number (e.g. 0771234567)"
              className="w-full rounded-xl border border-border bg-bg-surface px-4 py-3 text-[14px] outline-none focus:border-accent-sky"
            />
          </>
        )}

        {error && <p className="text-[12px] text-accent-coral">{error}</p>}
        {mobileNotice && <p className="text-[12px] text-accent-sky">{mobileNotice}</p>}
        <Button onClick={submitTopUp} disabled={submitting} className="w-full">
          {submitting ? "Processing…" : `Top up ${currency}`}
        </Button>
      </div>

      <div className="mt-6 space-y-2.5">
        <h2 className="font-display text-[14px] font-semibold text-text-secondary">Recent top-ups</h2>
        {transactions.length === 0 && (
          <EmptyState
            variant="inline"
            icon={Receipt}
            title="No top-ups yet"
            description="Your wallet top-up history will show up here once you make your first one above."
          />
        )}
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
