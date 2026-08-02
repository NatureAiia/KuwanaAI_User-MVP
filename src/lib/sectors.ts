import { Smartphone, Landmark, ShieldCheck, GraduationCap, HeartPulse } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type SectorSlug = "telecom" | "banking" | "insurance" | "education" | "healthcare";

export const SECTORS: Record<
  SectorSlug,
  { name: string; slug: SectorSlug; icon: LucideIcon; status: "live" | "coming_soon"; blurb: string }
> = {
  telecom: {
    name: "Telecom",
    slug: "telecom",
    icon: Smartphone,
    status: "live",
    blurb: "Data bundles & voice plans",
  },
  banking: {
    name: "Banking",
    slug: "banking",
    icon: Landmark,
    status: "live",
    blurb: "Accounts & savings",
  },
  insurance: {
    name: "Insurance",
    slug: "insurance",
    icon: ShieldCheck,
    status: "live",
    blurb: "Motor, health & life cover",
  },
  education: {
    name: "Education",
    slug: "education",
    icon: GraduationCap,
    status: "live",
    blurb: "Schools & fees",
  },
  healthcare: {
    name: "Healthcare",
    slug: "healthcare",
    icon: HeartPulse,
    status: "coming_soon",
    blurb: "Coming soon",
  },
};

export const LIVE_SECTORS: SectorSlug[] = ["telecom", "banking", "insurance", "education"];
