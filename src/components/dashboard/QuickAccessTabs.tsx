import Link from "next/link";
import {
  Smartphone,
  Landmark,
  ShieldCheck,
  GraduationCap,
  Zap,
  Pill,
  Laptop2,
  Shirt,
} from "lucide-react";

// Curated "quick access" tabs — the categories shoppers most commonly jump to,
// deep-linked so one tap lands on a specific category rather than a whole
// sector. ExploreClient reads the `category` search param to pre-select it.
const QUICK_ACCESS_TABS = [
  { label: "Data bundles", href: "/explore/telecom?category=data-bundles", icon: Smartphone },
  { label: "Savings accounts", href: "/explore/banking?category=savings-accounts", icon: Landmark },
  { label: "Motor cover", href: "/explore/insurance?category=motor-insurance", icon: ShieldCheck },
  { label: "Schools", href: "/explore/education?category=secondary-schools", icon: GraduationCap },
  { label: "Prepaid tokens", href: "/explore/utilities?category=prepaid-tokens", icon: Zap },
  { label: "Health essentials", href: "/explore/pharmacy?category=otc-essentials", icon: Pill },
  { label: "Tech & gadgets", href: "/explore/electronics?category=tech-gadgets", icon: Laptop2 },
  { label: "Clothing", href: "/explore/fashion?category=clothing", icon: Shirt },
];

/**
 * A row of quick-jump tabs shown at the bottom of the home feed — a suggestion
 * of the categories people want fast access to, alongside the personalized
 * Recommended / Specials sections.
 */
export function QuickAccessTabs() {
  return (
    <section className="mt-2">
      <h2 className="font-display text-[18px] font-semibold">Quick access</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {QUICK_ACCESS_TABS.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="tap-target flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-bg-surface px-3.5 py-2 text-[12px] font-medium text-text-secondary hover:border-accent-sky/50 hover:text-accent-sky"
          >
            <Icon size={14} className="text-accent-teal" />
            {label}
          </Link>
        ))}
      </div>
    </section>
  );
}
