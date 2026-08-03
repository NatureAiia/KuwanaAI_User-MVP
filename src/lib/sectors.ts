import {
  Smartphone,
  Landmark,
  ShieldCheck,
  GraduationCap,
  HeartPulse,
  Car,
  Zap,
  Pill,
  Laptop2,
  Shirt,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type SectorSlug =
  | "telecom"
  | "banking"
  | "insurance"
  | "education"
  | "healthcare"
  | "transport"
  | "utilities"
  | "pharmacy"
  | "electronics"
  | "fashion";

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
  transport: {
    name: "Transport",
    slug: "transport",
    icon: Car,
    status: "live",
    blurb: "Ride & kombi fares",
  },
  utilities: {
    name: "Utilities",
    slug: "utilities",
    icon: Zap,
    status: "live",
    blurb: "Prepaid token fees",
  },
  pharmacy: {
    name: "Pharmacy",
    slug: "pharmacy",
    icon: Pill,
    status: "live",
    blurb: "Health essentials",
  },
  electronics: {
    name: "Tech & Electronics",
    slug: "electronics",
    icon: Laptop2,
    status: "live",
    blurb: "Gadgets & AI tools",
  },
  fashion: {
    name: "Clothes",
    slug: "fashion",
    icon: Shirt,
    status: "live",
    blurb: "Menswear, womenswear & footwear",
  },
};

export const LIVE_SECTORS: SectorSlug[] = [
  "telecom",
  "banking",
  "insurance",
  "education",
  "transport",
  "utilities",
  "pharmacy",
  "electronics",
  "fashion",
];
