import type { Metadata } from "next";

// signup/page.tsx is a client component ("use client") — metadata can only
// be exported from a server component, hence this thin wrapper.
export const metadata: Metadata = {
  title: "Sign up — Kuwana",
  description:
    "Create your free Kuwana account to get personalized, explainable comparisons across telecom, banking, insurance, and education in Zimbabwe.",
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
