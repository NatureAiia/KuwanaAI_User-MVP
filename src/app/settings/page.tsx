"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, ChevronRight, ShieldCheck, Wallet } from "lucide-react";
import { BottomTabBar } from "@/components/BottomTabBar";
import { Header } from "@/components/Header";
import { CurrencySwitcher } from "@/components/CurrencySwitcher";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { SwitchAccountButton } from "@/components/LogoutButton";

export default function SettingsPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [consents, setConsents] = useState<{
    research_use?: boolean;
    leaderboard_participation?: boolean;
    health_data_sharing?: boolean;
  }>({});

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
    fetch("/api/settings/consents")
      .then((r) => r.json())
      .then((d) => setConsents(d.consents ?? {}));
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setUnreadCount(data?.unreadCount ?? 0))
      .catch(() => {});
  }, []);

  async function updateConsent(
    key: "research_use" | "leaderboard_participation" | "health_data_sharing",
    value: boolean,
  ) {
    setConsents((prev) => ({ ...prev, [key]: value }));
    await fetch("/api/settings/consents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
  }

  async function logout() {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div id="main-content" tabIndex={-1} className="flex flex-1 flex-col px-5 pb-24 pt-6 md:px-10">
      <Header />
      <h1 className="mt-4 font-display text-[24px] font-bold">Settings</h1>

      <div className="mt-6 space-y-2.5">
        <Link
          href="/notifications"
          className="tap-target flex items-center justify-between rounded-xl border border-border bg-bg-surface px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <Bell size={18} className="text-text-secondary" />
            <div>
              <p className="text-[14px] font-medium">Notifications</p>
              <p className="text-[12px] text-text-muted">
                {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && <span className="h-2 w-2 rounded-full bg-accent-coral" />}
            <ChevronRight size={16} className="text-text-muted" />
          </div>
        </Link>
        <Link
          href="/wallet"
          className="tap-target flex items-center justify-between rounded-xl border border-border bg-bg-surface px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <Wallet size={18} className="text-text-secondary" />
            <div>
              <p className="text-[14px] font-medium">Wallet</p>
              <p className="text-[12px] text-text-muted">Top up with Paynow, view your balance</p>
            </div>
          </div>
          <ChevronRight size={16} className="text-text-muted" />
        </Link>
        <Link
          href="/trust"
          className="tap-target flex items-center justify-between rounded-xl border border-border bg-bg-surface px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <ShieldCheck size={18} className="text-text-secondary" />
            <div>
              <p className="text-[14px] font-medium">Trust &amp; transparency</p>
              <p className="text-[12px] text-text-muted">Our promises, and how we keep them</p>
            </div>
          </div>
          <ChevronRight size={16} className="text-text-muted" />
        </Link>
      </div>

      <div className="mt-6 space-y-2.5">
        <h2 className="font-display text-[14px] font-semibold text-text-secondary">Display currency</h2>
        <CurrencySwitcher />
      </div>

      <div className="mt-6 space-y-2.5">
        <h2 className="font-display text-[14px] font-semibold text-text-secondary">Consents</h2>
        <label className="flex items-start gap-3 rounded-xl border border-border bg-bg-surface p-4">
          <input
            type="checkbox"
            checked={!!consents.research_use}
            onChange={(e) => updateConsent("research_use", e.target.checked)}
            className="mt-0.5 tap-target"
          />
          <span className="text-[13px] text-text-secondary">
            Allow anonymized use of my comparison activity to improve recommendations.
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-xl border border-border bg-bg-surface p-4">
          <input
            type="checkbox"
            checked={!!consents.leaderboard_participation}
            onChange={(e) => updateConsent("leaderboard_participation", e.target.checked)}
            className="mt-0.5 tap-target"
          />
          <span className="text-[13px] text-text-secondary">
            Join the opt-in XP leaderboard under a nickname.
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-xl border border-border bg-bg-surface p-4">
          <input
            type="checkbox"
            checked={!!consents.health_data_sharing}
            onChange={(e) => updateConsent("health_data_sharing", e.target.checked)}
            className="mt-0.5 tap-target"
          />
          <span className="text-[13px] text-text-secondary">
            Allow anonymized use of my health data to improve healthcare comparisons — separate
            from the general research consent above.
          </span>
        </label>
      </div>

      <div className="mt-6 space-y-2.5">
        <h2 className="font-display text-[14px] font-semibold text-text-secondary">Account</h2>
        <div className="rounded-xl border border-border bg-bg-surface px-4 py-3">
          <p className="text-[13px] text-text-secondary">Email</p>
          <p className="text-[14px] font-medium">{email ?? "…"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="danger"
            onClick={logout}
            className="!px-3.5 !py-2 text-[13px]"
          >
            Log out
          </Button>
          <SwitchAccountButton />
        </div>
      </div>

      <BottomTabBar />
    </div>
  );
}
