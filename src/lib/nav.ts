import { Home, Compass, MessageCircle, Trophy, CircleUser, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

/** Primary nav destinations — shared by BottomTabBar (mobile) and Header's desktop nav. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/profile/quests", label: "Quests", icon: Trophy },
  { href: "/profile", label: "Profile", icon: CircleUser },
];

export function isNavItemActive(pathname: string | null, href: string) {
  return pathname === href || (href !== "/dashboard" && !!pathname?.startsWith(href));
}
