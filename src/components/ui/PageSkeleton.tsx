/**
 * Shared streaming placeholder for route-level `loading.tsx` files.
 *
 * WHY THESE ARE SCOPED PER ROUTE RATHER THAN PUT AT THE APP ROOT
 *
 * A single `src/app/loading.tsx` would cover every route with one file, and
 * that is exactly what was tried first. It silently broke every 404 in the
 * app: a `loading.tsx` wraps the segment in a Suspense boundary, Next starts
 * streaming the shell immediately, and the HTTP status is flushed with it —
 * so a later `notFound()` can no longer set 404. Measured, not theorised:
 *
 *   with root loading.tsx     /listing/<unknown>  ->  200
 *   without it                /listing/<unknown>  ->  404
 *
 * A soft 404 means search engines index missing and unpublished listings as
 * real pages, and any link checker or uptime probe reads a dead URL as
 * healthy. That is worse than a slightly later first paint.
 *
 * So these live only on segments that never call `notFound()` — the
 * authenticated, data-heavy routes where the win is real and the risk is
 * nil. `/listing/[id]`, `/explore/[sector]`, `/explore/[sector]/compare` and
 * the `/admin/*` pages all gate on `notFound()` and deliberately have none.
 */
export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="flex flex-1 flex-col gap-6 px-5 pt-6 md:px-10">
      <div className="flex items-center justify-between">
        <div className="h-7 w-28 animate-pulse rounded-lg bg-bg-surface" />
        <div className="h-7 w-7 animate-pulse rounded-lg bg-bg-surface" />
      </div>

      <div className="space-y-2">
        <div className="h-8 w-2/3 max-w-[420px] animate-pulse rounded-lg bg-bg-surface" />
        <div className="h-4 w-1/2 max-w-[320px] animate-pulse rounded bg-bg-surface" />
      </div>

      <div className="space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className="h-[92px] animate-pulse rounded-[var(--radius-card)] border border-border bg-bg-surface"
          />
        ))}
      </div>

      <span className="sr-only">Loading…</span>
    </div>
  );
}
