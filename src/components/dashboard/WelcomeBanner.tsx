/**
 * The dashboard's top greeting row. Just "Welcome back, Firstname" — the
 * level meter and quest line that used to live here were removed; the
 * streak indicator now lives in the global header (StreakBadge in Header.tsx).
 */
export function WelcomeBanner({ firstName }: { firstName: string | null }) {
  return (
    <div className="mt-4">
      <p className="text-[13px] text-text-secondary">Welcome back{firstName ? "," : ""}</p>
      <h1 className="font-display text-[24px] font-bold">{firstName ?? "there"}</h1>
    </div>
  );
}
