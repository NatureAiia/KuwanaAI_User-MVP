import {
  Package,
  Megaphone,
  Users,
  MessageSquare,
  Search,
  ClipboardList,
  LineChart,
  Wallet,
  History,
  Cpu,
  Percent,
  Landmark,
  ShieldAlert,
  KeyRound,
  Bell,
  ShoppingBasket,
  Flag,
  BellRing,
  Activity,
  type LucideIcon,
} from "lucide-react";

/**
 * Single source of truth for the admin section list — the hub page's
 * "Manage" grid and the desktop sidebar both render off this so a new
 * section only needs to be added once. `group` drives the sidebar's grouped
 * sections (see AdminSidebar) the same way CorporatePortalNav's NAV_GROUPS
 * does, but kept as one flat array with a group tag rather than a nested
 * structure — the hub grid and AdminHeader's breadcrumb lookup both need the
 * flat form already, and a flat array reordered so same-group entries sit
 * together is enough for AdminSidebar to group by first-seen order without
 * a second data structure to keep in sync.
 */
export const ADMIN_LINKS: { href: string; label: string; blurb: string; icon: LucideIcon; group: string }[] = [
  { href: "/admin/catalog", label: "Catalog", blurb: "Providers and listings across every sector — create, edit, retire.", icon: Package, group: "Catalog" },
  { href: "/admin/adverts", label: "Adverts", blurb: "Promo slots that rotate through the explore page's ad card.", icon: Megaphone, group: "Catalog" },
  { href: "/admin/users", label: "Users", blurb: "The only way to grant Corporate/Regulator/Provider access.", icon: Users, group: "Catalog" },

  { href: "/admin/social-mentions", label: "Social price mentions", blurb: "Review free-scanner posts that mention a price.", icon: MessageSquare, group: "Review queue" },
  { href: "/admin/scraper", label: "Web scraper", blurb: "Review scraped/searched pricing before it becomes a listing.", icon: Search, group: "Review queue" },
  { href: "/admin/corporate-requests", label: "Corporate requests", blurb: "Price/product changes submitted by corporate accounts, awaiting approval.", icon: ClipboardList, group: "Review queue" },

  { href: "/admin/pricing-intelligence", label: "Pricing intelligence", blurb: "Outlier pricing and sector-wide fee comparison across every category.", icon: LineChart, group: "Intelligence" },
  { href: "/admin/investigations", label: "Investigations", blurb: "Enforcement cases against any provider's listings, market-wide.", icon: Flag, group: "Intelligence" },
  { href: "/admin/alerts", label: "Alerts", blurb: "Platform-wide threshold watchers — providers, listings, cases, requests.", icon: BellRing, group: "Intelligence" },
  { href: "/admin/live-feed", label: "Live feed", blurb: "Every recent listing change across every provider, refreshing automatically.", icon: Activity, group: "Intelligence" },
  { href: "/admin/business-conditions", label: "Business conditions", blurb: "Regulatory changes, competitor moves, and macro triggers worth watching.", icon: ShieldAlert, group: "Intelligence" },

  { href: "/admin/discounts", label: "Discounts", blurb: "Provider discount rules, scoped to a category or a single listing.", icon: Percent, group: "Market data" },
  { href: "/admin/economic-drivers", label: "Economic drivers", blurb: "FX rate, inflation and other macro indicators shown as pricing context.", icon: Landmark, group: "Market data" },
  { href: "/admin/market-baskets", label: "Market baskets", blurb: "Curated cost-of-living baskets tracked on the regulator price index.", icon: ShoppingBasket, group: "Market data" },

  { href: "/admin/transactions", label: "Transactions", blurb: "Every Paynow wallet top-up and its current status.", icon: Wallet, group: "Finance" },

  { href: "/admin/audit", label: "Audit log", blurb: "Who approved/rejected/deleted what, and every role change.", icon: History, group: "System" },
  { href: "/admin/llm", label: "AI models & cost", blurb: "Switch the model behind each AI feature and track calls and spend.", icon: Cpu, group: "System" },
  { href: "/admin/api-keys", label: "API keys", blurb: "Read-only credentials for external BI tools (Power BI, Tableau, etc.).", icon: KeyRound, group: "System" },
  { href: "/admin/notifications", label: "Notifications", blurb: "Business conditions assigned to you that are due for review.", icon: Bell, group: "System" },
];

/** Groups ADMIN_LINKS by `group`, preserving first-seen order — same shape CorporatePortalNav's NAV_GROUPS uses, derived instead of hand-maintained twice. */
export function getAdminNavGroups(): { label: string; links: typeof ADMIN_LINKS }[] {
  const groups: { label: string; links: typeof ADMIN_LINKS }[] = [];
  for (const link of ADMIN_LINKS) {
    let group = groups.find((g) => g.label === link.group);
    if (!group) {
      group = { label: link.group, links: [] };
      groups.push(group);
    }
    group.links.push(link);
  }
  return groups;
}
