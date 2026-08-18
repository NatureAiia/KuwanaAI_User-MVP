import type { Metadata } from "next";

// login/page.tsx is a client component ("use client") — metadata can only be
// exported from a server component, hence this thin wrapper.
//
// dynamic = "force-dynamic" lives here for the same reason: route segment
// config can't be exported from a "use client" file either, and a statically
// prerendered shell bakes in a dead nonce that blocks every script under the
// CSP in src/proxy.ts — see src/app/page.tsx.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Log in — Kuwana",
  description: "Log in to your Kuwana account to compare providers and track your saved comparisons.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
