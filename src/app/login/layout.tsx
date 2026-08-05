import type { Metadata } from "next";

// login/page.tsx is a client component ("use client") — metadata can only be
// exported from a server component, hence this thin wrapper.
export const metadata: Metadata = {
  title: "Log in — Kuwana",
  description: "Log in to your Kuwana account to compare providers and track your saved comparisons.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
