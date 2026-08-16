/**
 * "Name the fix, not the fault" — render the specific, actionable message a
 * validation check produced ("Password needs at least 8 characters"), not a
 * generic "Invalid input." Renders nothing when there's no error so callers
 * can always mount it unconditionally under a field.
 */
export function FieldError({ error }: { error?: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="mt-1 text-[12px] text-accent-coral">
      {error}
    </p>
  );
}
