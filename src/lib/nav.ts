import { Home, Compass, MessageCircle, Images, CircleUser, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

/**
 * Primary nav destinations — shared by BottomTabBar (mobile) and Header's
 * desktop nav. Quests used to occupy this slot; it's now reached via the
 * floating action button BottomTabBar renders alongside this nav instead, so
 * Shorts (the personalized image feed) could take the slot without pushing
 * the bar to six items.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/shorts", label: "Shorts", icon: Images },
  { href: "/profile", label: "Profile", icon: CircleUser },
];

export function isNavItemActive(pathname: string | null, href: string) {
  return pathname === href || (href !== "/dashboard" && !!pathname?.startsWith(href));
}
