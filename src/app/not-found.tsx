import { LinkButton } from "@/components/ui/Button";

/**
 * 404 page. Reached both by a genuinely unknown URL and by the deliberate
 * `notFound()` calls in the catalog routes — including the one on
 * /listing/[id] that hides a draft, pending, or rejected listing from
 * consumers.
 *
 * That second case is why the copy stays vague about *why* a page is
 * missing: distinguishing "no such listing" from "that listing exists but
 * isn't published" would turn this page into an oracle for unpublished
 * provider submissions.
 */
export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-16 text-center">
      <span className="font-display text-xl font-bold">kuwana</span>
      <p className="mt-6 font-mono text-[13px] text-accent-sky">404</p>
      <h1 className="mt-1 font-display text-[24px] font-bold">We couldn&apos;t find that page</h1>
      <p className="mt-2 max-w-[44ch] text-[14px] leading-[1.6] text-text-secondary">
        The link may be out of date, or the listing may no longer be available. Everything else is
        still where you left it.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <LinkButton href="/explore" size="lg">
          Browse comparisons
        </LinkButton>
        <LinkButton href="/" variant="secondary" size="lg">
          Go home
        </LinkButton>
      </div>
    </div>
  );
}
