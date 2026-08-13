import Link from "next/link";

const LINKS = [
  { href: "/corporate", label: "Market Intelligence" },
  { href: "/corporate/products", label: "My Products" },
  { href: "/corporate/requests", label: "Requests" },
] as const;

export function CorporatePortalNav({ active }: { active: (typeof LINKS)[number]["href"] }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`tap-target rounded-full border px-4 py-2 text-[13px] font-medium ${
            active === link.href
              ? "border-accent-sky bg-accent-sky/15 text-accent-sky"
              : "border-border text-text-secondary"
          }`}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
