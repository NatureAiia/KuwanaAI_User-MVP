import type { Metadata } from "next";

// signup/page.tsx is a client component ("use client") — metadata can only
// be exported from a server component, hence this thin wrapper.
//
// dynamic = "force-dynamic" lives here for the same reason: route segment
// config can't be exported from a "use client" file either, and a statically
// prerendered shell bakes in a dead nonce that blocks every script under the
// CSP in src/proxy.ts — see src/app/page.tsx.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign up — Kuwana",
  description:
    "Create your free Kuwana account to get personalized, explainable comparisons across telecom, banking, insurance, and education in Zimbabwe.",
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
