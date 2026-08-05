/** Shared route-level loading UI — same spinner already used inline in CompareClient. */
export function PageLoading() {
  return (
    <div className="flex flex-1 items-center justify-center px-5 py-24">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-sky border-t-transparent" />
    </div>
  );
}
