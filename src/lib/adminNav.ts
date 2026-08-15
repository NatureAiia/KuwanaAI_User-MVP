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
  type LucideIcon,
} from "lucide-react";

/**
 * Single source of truth for the admin section list — the hub page's
 * "Manage" grid and the desktop sidebar both render off this so a new
 * section only needs to be added once.
 */
export const ADMIN_LINKS: { href: string; label: string; blurb: string; icon: LucideIcon }[] = [
  { href: "/admin/catalog", label: "Catalog", blurb: "Providers and listings across every sector — create, edit, retire.", icon: Package },
  { href: "/admin/adverts", label: "Adverts", blurb: "Promo slots that rotate through the explore page's ad card.", icon: Megaphone },
  { href: "/admin/users", label: "Users", blurb: "The only way to grant Corporate/Regulator/Provider access.", icon: Users },
  { href: "/admin/social-mentions", label: "Social price mentions", blurb: "Review free-scanner posts that mention a price.", icon: MessageSquare },
  { href: "/admin/scraper", label: "Web scraper", blurb: "Review scraped/searched pricing before it becomes a listing.", icon: Search },
  { href: "/admin/corporate-requests", label: "Corporate requests", blurb: "Price/product changes submitted by corporate accounts, awaiting approval.", icon: ClipboardList },
  { href: "/admin/pricing-intelligence", label: "Pricing intelligence", blurb: "Outlier pricing and sector-wide fee comparison across every category.", icon: LineChart },
  { href: "/admin/discounts", label: "Discounts", blurb: "Provider discount rules, scoped to a category or a single listing.", icon: Percent },
  { href: "/admin/economic-drivers", label: "Economic drivers", blurb: "FX rate, inflation and other macro indicators shown as pricing context.", icon: Landmark },
  { href: "/admin/business-conditions", label: "Business conditions", blurb: "Regulatory changes, competitor moves, and macro triggers worth watching.", icon: ShieldAlert },
  { href: "/admin/transactions", label: "Transactions", blurb: "Every Paynow wallet top-up and its current status.", icon: Wallet },
  { href: "/admin/audit", label: "Audit log", blurb: "Who approved/rejected/deleted what, and every role change.", icon: History },
  { href: "/admin/llm", label: "AI models & cost", blurb: "Switch the model behind each AI feature and track calls and spend.", icon: Cpu },
  { href: "/admin/api-keys", label: "API keys", blurb: "Read-only credentials for external BI tools (Power BI, Tableau, etc.).", icon: KeyRound },
  { href: "/admin/notifications", label: "Notifications", blurb: "Business conditions assigned to you that are due for review.", icon: Bell },
];
