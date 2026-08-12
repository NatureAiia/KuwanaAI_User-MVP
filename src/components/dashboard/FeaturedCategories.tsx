import Link from "next/link";
import { SECTORS, LIVE_SECTORS } from "@/lib/sectors";

/**
 * "Featured Categories" — the first section on the home page, sitting right
 * under the search bar. Renders each live sector as a circular icon chip in
 * a horizontally-scrolling row (a deliberate change from the old rectangular
 * grid so the row reads as quick-jump shortcuts rather than a table).
 */
export function FeaturedCategories() {
  return (
    <section className="mt-2">
      <h2 className="font-display text-[18px] font-semibold">Featured Categories</h2>
      <p className="mt-1 text-[12px] text-text-muted">Jump straight into a category to compare</p>
      <div className="mt-4 flex gap-5 overflow-x-auto pb-2">
        {Object.values(SECTORS).map((sector) => {
          const Icon = sector.icon;
          const live = LIVE_SECTORS.includes(sector.slug);
          const circle = (
            <span
              className={
                live
                  ? "flex h-16 w-16 items-center justify-center rounded-full border border-accent-teal/30 bg-bg-surface text-accent-teal shadow-[0_4px_14px_-6px_rgba(0,0,0,0.35)]"
                  : "flex h-16 w-16 items-center justify-center rounded-full border border-border bg-bg-surface text-text-muted"
              }
            >
              <Icon size={26} />
            </span>
          );
          return live ? (
            <Link
              key={sector.slug}
              href={`/explore/${sector.slug}`}
              aria-label={`Explore ${sector.name}`}
              className="group flex w-[74px] shrink-0 flex-col items-center gap-2"
            >
              {circle}
              <span className="text-center text-[12px] font-medium text-text-secondary group-hover:text-accent-teal">
                {sector.name}
              </span>
            </Link>
          ) : (
            <div
              key={sector.slug}
              aria-disabled="true"
              className="flex w-[74px] shrink-0 flex-col items-center gap-2 opacity-60"
            >
              {circle}
              <span className="text-center text-[12px] font-medium text-text-muted">{sector.name}</span>
              <span className="-mt-1.5 rounded-full border border-border bg-bg-base px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-text-muted">
                Coming soon
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
