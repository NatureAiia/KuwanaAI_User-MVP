import Link from "next/link";
import { Wallet, ChevronRight } from "lucide-react";

// Surfaces the same wallet a consumer account has — there's no seller
// payout/earnings flow yet (marketplace orders aren't built, see the
// platform roadmap), so this is balance visibility for consistency with the
// rest of the app, not a "you got paid" feature. Top-up happens on /wallet
// itself; this just makes the balance visible without leaving /provider.
export function SellerWalletTile({ usd, zig }: { usd: string; zig: string }) {
  return (
    <Link
      href="/wallet"
      className="tap-target mt-5 flex items-center justify-between rounded-[var(--radius-card)] border border-border bg-bg-surface p-4"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-teal/10 text-accent-teal">
          <Wallet size={18} />
        </span>
        <div>
          <p className="text-[13px] font-semibold">Wallet</p>
          <p className="font-mono text-[12.5px] text-text-secondary">
            USD {usd} · ZiG {zig}
          </p>
        </div>
      </div>
      <ChevronRight size={16} className="text-text-muted" />
    </Link>
  );
}
