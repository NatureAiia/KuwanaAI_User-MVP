export function NotLinkedCard() {
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-bg-surface p-6">
      <h1 className="font-display text-[18px] font-bold">Not linked yet</h1>
      <p className="mt-2 text-[13px] text-text-secondary">
        Your account has corporate access, but your company isn&apos;t linked to a product
        catalog yet. Ask an admin to link your email domain at /admin/catalog.
      </p>
    </div>
  );
}
