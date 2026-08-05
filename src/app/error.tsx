"use client";

import { useEffect } from "react";
import { Button, LinkButton } from "@/components/ui/Button";

/**
 * Route-segment error boundary.
 *
 * Without this file, an unhandled server error renders Next's own error
 * screen. In production that is a generic page, but the `digest` and the
 * framework's own framing still tell a visitor more about the stack than
 * they need, and there is no way back into the app except the browser's
 * back button.
 *
 * What is shown here is deliberately free of detail. `error.message` is NOT
 * rendered: a thrown Prisma error carries the failing query and, on some
 * driver errors, the connection string — and this component receives the
 * real error object in development, so printing it would be a habit that
 * only breaks in production.
 *
 * The digest is shown because it is the one thing that makes a user's report
 * actionable: it is a hash Next also writes to the server log, so "I saw
 * 1a2b3c4d" points straight at the stack trace without exposing it.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server-thrown errors are already logged server-side; this catches the
    // client-side ones, which otherwise vanish silently.
    console.error("[route-error]", error.digest ?? "(no digest)", error.message);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-16 text-center">
      <span className="font-display text-xl font-bold">kuwana</span>
      <h1 className="mt-6 font-display text-[24px] font-bold">Something went wrong</h1>
      <p className="mt-2 max-w-[44ch] text-[14px] leading-[1.6] text-text-secondary">
        This one is on us, not you. Nothing you were comparing has been lost — try again, or head
        back and pick up where you were.
      </p>

      {error.digest && (
        <p className="mt-4 font-mono text-[11px] text-text-muted">
          Reference: {error.digest}
        </p>
      )}

      <div className="mt-6 flex items-center gap-3">
        <Button onClick={reset} size="lg">
          Try again
        </Button>
        <LinkButton href="/" variant="secondary" size="lg">
          Go home
        </LinkButton>
      </div>
    </div>
  );
}
