import Link from "next/link";
import { clsx } from "clsx";
import {
  Smartphone,
  Landmark,
  ShieldCheck,
  GraduationCap,
  Zap,
  Laptop2,
  Shirt,
  HeartPulse,
  Hotel,
  ShoppingCart,
  School,
  Bus,
} from "lucide-react";
import { LIVE_SECTORS, type SectorSlug } from "@/lib/sectors";

// Curated "quick access" tabs — the categories shoppers most commonly jump to,
// deep-linked so one tap lands on a specific category rather than a whole
// sector. ExploreClient reads the `category` search param to pre-select it.
const QUICK_ACCESS_TABS = [
  { label: "Data bundles", href: "/explore/telecom?category=data-bundles", icon: Smartphone },
  { label: "Savings accounts", href: "/explore/banking?category=savings-accounts", icon: Landmark },
  { label: "Motor cover", href: "/explore/insurance?category=motor-insurance", icon: ShieldCheck },
  { label: "Schools", href: "/explore/education?category=secondary-schools", icon: GraduationCap },
  { label: "University", href: "/explore/education?category=universities", icon: School },
  { label: "Medical aid", href: "/explore/insurance?category=medical-aid-plans", icon: HeartPulse },
  { label: "Prepaid tokens", href: "/explore/utilities?category=prepaid-tokens", icon: Zap },
  { label: "Bus fares", href: "/explore/transport?category=bus-fares", icon: Bus },
  { label: "Hotels", href: "/explore/hotels?category=hotel-stays", icon: Hotel },
  { label: "Groceries", href: "/explore/retail?category=maize-meal", icon: ShoppingCart },
  { label: "Tech & gadgets", href: "/explore/electronics?category=tech-gadgets", icon: Laptop2 },
  { label: "Clothing", href: "/explore/fashion?category=clothing", icon: Shirt },
];

/**
 * A row of quick-jump tabs shown at the bottom of the home feed — a suggestion
 * of the categories people want fast access to, alongside the personalized
 * Recommended / Specials sections. Tabs for sectors that aren't live yet are
 * greyed out with a "Soon" chip so the row never deep-links to a 404.
 */
export function QuickAccessTabs() {
  return (
    <section className="mt-2">
      <h2 className="font-display text-[18px] font-semibold">Quick access</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {QUICK_ACCESS_TABS.map(({ label, href, icon: Icon }) => {
          const slug = href.split("/")[2].split("?")[0] as SectorSlug;
          const live = LIVE_SECTORS.includes(slug);
          return live ? (
            <Link
              key={href}
              href={href}
              className="tap-target flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-bg-surface px-3.5 py-2 text-[12px] font-medium text-text-secondary hover:border-accent-sky/50 hover:text-accent-sky"
            >
              <Icon size={14} className="text-accent-teal" />
              {label}
            </Link>
          ) : (
            <span
              key={href}
              aria-disabled="true"
              className={clsx(
                "tap-target flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-bg-surface px-3.5 py-2 text-[12px] font-medium text-text-muted opacity-60",
              )}
            >
              <Icon size={14} />
              {label}
              <span className="rounded-full border border-border bg-bg-base px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide">
                Soon
              </span>
            </span>
          );
        })}
      </div>
    </section>
  );
}
