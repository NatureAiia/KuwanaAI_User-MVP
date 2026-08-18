// leaderboard/page.tsx is a client component ("use client") — route segment
// config can't be exported from a "use client" file, hence this thin
// wrapper. Without it this route gets statically prerendered, which bakes
// in a dead CSP nonce and blocks every script under the policy in
// src/proxy.ts — see src/app/page.tsx for the full explanation.
export const dynamic = "force-dynamic";

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
